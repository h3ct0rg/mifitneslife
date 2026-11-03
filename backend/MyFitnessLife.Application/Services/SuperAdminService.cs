using System.Globalization;
using System.Net.Mail;
using System.Text;
using MyFitnessLife.Application.DTOs.Admin;
using MyFitnessLife.Application.DTOs.Patients;
using MyFitnessLife.Application.Exceptions;
using MyFitnessLife.Application.Interfaces;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using MyFitnessLife.Domain.Interfaces;

namespace MyFitnessLife.Application.Services;

public class SuperAdminService : ISuperAdminService
{
    private const int MaxPageSize = 100;
    private const int MinPasswordLength = 4; // Igual a la política de Identity configurada en Program.cs.
    private const int MonthsInSeries = 6;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITenantActivityService _activityService;

    public SuperAdminService(
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        ITenantActivityService activityService)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _activityService = activityService;
    }

    // ───────────────────────────── Dashboard ─────────────────────────────

    public async Task<AdminDashboardDto> GetDashboardAsync()
    {
        var now = DateTime.UtcNow;
        var last30 = now.AddDays(-30);
        var currentMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var seriesStart = currentMonth.AddMonths(-(MonthsInSeries - 1));

        var totalTenants = await _unitOfWork.Tenants.CountTotalAsync();
        var activeTenants = await _unitOfWork.Tenants.CountActiveAsync();
        var totalUsers = await _unitOfWork.Users.CountAllAsync();
        var activeUsers = await _unitOfWork.Users.CountAllAsync(UserStatus.Active);
        var totalPatients = await _unitOfWork.Patients.CountAllAsync();

        var byRole = await _unitOfWork.Users.CountByRoleAsync();
        var usersByRole = Enum.GetValues<UserRole>()
            .ToDictionary(r => r.ToString(), r => byRole.GetValueOrDefault(r));

        var newUsers = await _unitOfWork.Users.CountCreatedSinceAsync(last30);
        var newTenants = await _unitOfWork.Tenants.CountCreatedSinceAsync(last30);
        var newPatients = await _unitOfWork.Patients.CountCreatedSinceAsync(last30);

        var usersByMonth = await _unitOfWork.Users.CountCreatedByMonthAsync(seriesStart);
        var tenantsByMonth = await _unitOfWork.Tenants.CountCreatedByMonthAsync(seriesStart);
        var patientsByMonth = await _unitOfWork.Patients.CountCreatedByMonthAsync(seriesStart);

        var series = Enumerable.Range(0, MonthsInSeries)
            .Select(i => seriesStart.AddMonths(i))
            .Select(m =>
            {
                var key = (m.Year, m.Month);
                return new RegistrationsByMonthDto
                {
                    Month = m.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                    Users = usersByMonth.GetValueOrDefault(key),
                    Tenants = tenantsByMonth.GetValueOrDefault(key),
                    Patients = patientsByMonth.GetValueOrDefault(key)
                };
            })
            .ToList();

        var allTenants = (await _unitOfWork.Tenants.GetAllAsync()).ToList();
        var tenantDtos = await BuildTenantDtosAsync(allTenants.Where(t => t.IsActive).OrderByDescending(t => t.CreatedAt));
        var tenantNames = allTenants.ToDictionary(t => t.Id, t => t.Name);

        var recent = await _unitOfWork.AuditLogs.GetRecentAsync(50);
        var activity = recent.Select(a => new TenantActivityDto
        {
            TenantId = a.TenantId ?? Guid.Empty,
            TenantName = a.TenantId.HasValue && tenantNames.TryGetValue(a.TenantId.Value, out var name) ? name : "Sistema",
            Timestamp = a.Timestamp,
            Action = a.Action,
            UserEmail = a.Details,
            Entity = a.Entity
        }).ToList();

        return new AdminDashboardDto
        {
            TotalTenants = totalTenants,
            ActiveTenants = activeTenants,
            TotalUsers = totalUsers,
            ActiveUsers = activeUsers,
            TotalPatients = totalPatients,
            UsersByRole = usersByRole,
            NewUsersLast30Days = newUsers,
            NewTenantsLast30Days = newTenants,
            NewPatientsLast30Days = newPatients,
            RegistrationsByMonth = series,
            Tenants = tenantDtos,
            RecentActivity = activity
        };
    }

    // ───────────────────────────── Tenants ─────────────────────────────

    public async Task<IEnumerable<TenantDto>> GetTenantsAsync()
    {
        var tenants = await _unitOfWork.Tenants.GetAllAsync();
        return await BuildTenantDtosAsync(tenants.OrderByDescending(t => t.CreatedAt));
    }

    public async Task<TenantDto> GetTenantAsync(Guid id)
    {
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Tenant no encontrado.");
        return await BuildTenantDtoAsync(tenant);
    }

    public async Task<TenantDto> CreateTenantAsync(CreateTenantRequest request)
    {
        var name = RequireTenantName(request.Name);

        var explicitSlug = !string.IsNullOrWhiteSpace(request.Slug);
        var slug = Slugify(explicitSlug ? request.Slug! : name);
        if (string.IsNullOrEmpty(slug))
            throw new InvalidOperationException(explicitSlug
                ? "El slug no es válido. Usa letras, números y guiones."
                : "No se pudo generar un slug a partir del nombre. Indica un slug.");

        if (await _unitOfWork.Tenants.GetBySlugAsync(slug) is not null)
            throw new ConflictException(explicitSlug
                ? $"Ya existe un tenant con el slug '{slug}'."
                : $"Ya existe un tenant con el slug '{slug}'. Indica un slug distinto.");

        var tenant = new Tenant
        {
            Name = name,
            Slug = slug,
            Description = NormalizeOptional(request.Description),
            IsActive = true
        };

        await _unitOfWork.Tenants.AddAsync(tenant);
        await _activityService.RecordCreateTenantAsync(tenant.Id, tenant.Name);
        await _unitOfWork.SaveChangesAsync();

        return ToTenantDto(tenant, 0, 0, 0);
    }

    public async Task<TenantDto> UpdateTenantAsync(Guid id, UpdateTenantRequest request)
    {
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Tenant no encontrado.");

        var wasActive = tenant.IsActive;
        tenant.Name = RequireTenantName(request.Name);
        tenant.Description = NormalizeOptional(request.Description);
        tenant.IsActive = request.IsActive;
        tenant.UpdatedAt = DateTime.UtcNow;

        var action = wasActive == tenant.IsActive
            ? "update_tenant"
            : tenant.IsActive ? "activate_tenant" : "deactivate_tenant";
        await _activityService.RecordEntityAsync(tenant.Id, action, "Tenant", tenant.Id.ToString(), tenant.Name);
        await _unitOfWork.SaveChangesAsync();

        return await BuildTenantDtoAsync(tenant);
    }

    public async Task<IEnumerable<TenantActivityDto>> GetTenantActivityAsync(Guid tenantId)
    {
        var logs = await _unitOfWork.AuditLogs.GetByTenantAsync(tenantId, 100);
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId);

        return logs.Select(a => new TenantActivityDto
        {
            TenantId = tenantId,
            TenantName = tenant?.Name ?? "Desconocido",
            Timestamp = a.Timestamp,
            Action = a.Action,
            UserEmail = a.Details,
            Entity = a.Entity
        });
    }

    // ───────────────────────────── Usuarios ─────────────────────────────

    public async Task<PagedResult<AdminUserDto>> GetUsersAsync(string? search, Guid? tenantId, string? role, int page, int pageSize)
    {
        UserRole? roleFilter = string.IsNullOrWhiteSpace(role) ? null : ParseRole(role);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var total = await _unitOfWork.Users.CountSearchAsync(search, tenantId, roleFilter);
        var users = await _unitOfWork.Users.SearchAsync(search, tenantId, roleFilter, page, pageSize);

        return new PagedResult<AdminUserDto>
        {
            Page = page,
            PageSize = pageSize,
            Total = total,
            Items = users.Select(u => ToAdminUserDto(u, u.Tenant?.Name)).ToList()
        };
    }

    public async Task<AdminUserDto> CreateUserAsync(CreateAdminUserRequest request)
    {
        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (!IsValidEmail(email))
            throw new InvalidOperationException("El email no es válido.");

        var (firstName, lastName) = SplitFullName(request.FullName);

        if (string.IsNullOrEmpty(request.Password) || request.Password.Length < MinPasswordLength)
            throw new InvalidOperationException($"La contraseña debe tener al menos {MinPasswordLength} caracteres.");

        var role = ParseRole(request.Role);
        var tenant = await ValidateAssignmentAsync(role, request.TenantId);

        if (await _unitOfWork.Users.EmailExistsAsync(email))
            throw new ConflictException("Ya existe un usuario con ese email.");

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            SecurityStamp = Guid.NewGuid().ToString("N"),
            FirstName = firstName,
            LastName = lastName,
            PasswordHash = _passwordHasher.Hash(request.Password),
            Role = role,
            TenantId = tenant?.Id,
            Tenant = tenant,
            Status = UserStatus.Active,
            EmailConfirmed = true
        };

        await _unitOfWork.Users.AddAsync(user);
        await _unitOfWork.Users.SyncIdentityRoleAsync(user.Id, role.ToString());

        if (role == UserRole.Patient && tenant is not null)
            await PatientProfiles.EnsureAsync(_unitOfWork, tenant.Id, email, firstName, lastName);

        if (tenant is not null)
            await _activityService.RecordEntityAsync(tenant.Id, "create_user", "User", user.Id.ToString(), email);

        await _unitOfWork.SaveChangesAsync();

        return ToAdminUserDto(user, tenant?.Name);
    }

    public async Task<AdminUserDto> UpdateUserAsync(Guid actorId, Guid id, UpdateAdminUserRequest request)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        var (firstName, lastName) = SplitFullName(request.FullName);

        var deactivating = !request.IsActive && user.Status == UserStatus.Active;
        if (deactivating)
        {
            if (user.Id == actorId)
                throw new InvalidOperationException("No puedes desactivar tu propia cuenta.");

            if (user.Role == UserRole.SuperAdmin
                && await _unitOfWork.Users.CountActiveByRoleAsync(UserRole.SuperAdmin, user.Id) == 0)
                throw new InvalidOperationException("No se puede desactivar al último SuperAdmin activo de la plataforma.");
        }

        user.FirstName = firstName;
        user.LastName = lastName;
        if (request.IsActive)
            user.Status = UserStatus.Active;
        else if (deactivating)
            user.Status = UserStatus.Inactive;
        user.UpdatedAt = DateTime.UtcNow;

        if (user.TenantId.HasValue)
            await _activityService.RecordEntityAsync(user.TenantId.Value, "update_user", "User", user.Id.ToString(), user.Email);

        await _unitOfWork.SaveChangesAsync();

        return ToAdminUserDto(user, user.Tenant?.Name);
    }

    public async Task<AdminUserDto> AssignUserAsync(Guid actorId, Guid id, AssignUserRequest request)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        var role = ParseRole(request.Role);
        var tenant = await ValidateAssignmentAsync(role, request.TenantId);

        var losesSuperAdmin = user.Role == UserRole.SuperAdmin && role != UserRole.SuperAdmin;
        if (losesSuperAdmin)
        {
            if (user.Id == actorId)
                throw new InvalidOperationException("No puedes quitarte tu propio rol SuperAdmin.");

            if (user.Status == UserStatus.Active
                && await _unitOfWork.Users.CountActiveByRoleAsync(UserRole.SuperAdmin, user.Id) == 0)
                throw new InvalidOperationException("No se puede dejar la plataforma sin un SuperAdmin activo.");
        }

        user.Role = role;
        user.TenantId = tenant?.Id;
        user.Tenant = tenant;
        user.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.Users.SyncIdentityRoleAsync(user.Id, role.ToString());

        if (role == UserRole.Patient && tenant is not null)
            await PatientProfiles.EnsureAsync(_unitOfWork, tenant.Id, user.Email!, user.FirstName, user.LastName);

        if (tenant is not null)
            await _activityService.RecordEntityAsync(tenant.Id, "assign_role", "User", user.Id.ToString(), user.Email);

        await _unitOfWork.SaveChangesAsync();

        return ToAdminUserDto(user, tenant?.Name);
    }

    // ───────────────────────────── Eliminación (hard delete) ─────────────────────────────

    public async Task<TenantDeleteImpactDto> GetTenantDeleteImpactAsync(Guid id)
    {
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Tenant no encontrado.");

        var impact = await _unitOfWork.Purge.GetTenantImpactAsync(id);
        return new TenantDeleteImpactDto
        {
            TenantId = tenant.Id,
            Name = tenant.Name,
            Users = impact.Users,
            Patients = impact.Patients,
            Appointments = impact.Appointments,
            OtherRecords = impact.OtherRecords
        };
    }

    public async Task DeleteTenantAsync(Guid actorId, Guid id)
    {
        var tenant = await _unitOfWork.Tenants.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Tenant no encontrado.");

        // D6: evento sin TenantId para que sobreviva al borrado del tenant.
        await _unitOfWork.Purge.PurgeTenantAsync(id, new AuditLog
        {
            TenantId = null,
            UserId = actorId,
            Action = "delete_tenant",
            Entity = "Tenant",
            EntityId = tenant.Id.ToString(),
            Details = $"{tenant.Name} ({tenant.Slug})"
        });
    }

    public async Task<UserDeleteImpactDto> GetUserDeleteImpactAsync(Guid id)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        var impact = await _unitOfWork.Purge.GetUserImpactAsync(id);
        return new UserDeleteImpactDto
        {
            UserId = user.Id,
            Email = user.Email ?? string.Empty,
            Role = user.Role.ToString(),
            TenantName = user.TenantId.HasValue ? user.Tenant?.Name : null,
            PatientProfile = impact.PatientProfile,
            Appointments = impact.Appointments,
            OtherRecords = impact.OtherRecords
        };
    }

    public async Task DeleteUserAsync(Guid actorId, Guid id)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        if (user.Id == actorId)
            throw new InvalidOperationException("No puedes eliminar tu propia cuenta.");

        if (user.Role == UserRole.SuperAdmin
            && user.Status == UserStatus.Active
            && await _unitOfWork.Users.CountActiveByRoleAsync(UserRole.SuperAdmin, user.Id) == 0)
            throw new InvalidOperationException("No se puede eliminar al último SuperAdmin activo de la plataforma.");

        var tenantInfo = user.Tenant is not null ? $" [{user.Tenant.Name}]" : string.Empty;

        // D6: evento sin TenantId (plataforma); se conserva aunque luego se borre el tenant.
        await _unitOfWork.Purge.PurgeUserAsync(id, new AuditLog
        {
            TenantId = null,
            UserId = actorId,
            Action = "delete_user",
            Entity = "User",
            EntityId = user.Id.ToString(),
            Details = $"{user.Email}{tenantInfo}"
        });
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    /// <summary>D2: SuperAdmin ⇒ sin tenant; cualquier otro rol ⇒ tenant existente y activo.</summary>
    private async Task<Tenant?> ValidateAssignmentAsync(UserRole role, Guid? tenantId)
    {
        if (role == UserRole.SuperAdmin)
        {
            if (tenantId.HasValue)
                throw new InvalidOperationException("Un SuperAdmin no puede pertenecer a un tenant.");
            return null;
        }

        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
            throw new InvalidOperationException($"El rol {role} requiere un tenant.");

        var tenant = await _unitOfWork.Tenants.GetByIdAsync(tenantId.Value)
            ?? throw new InvalidOperationException("El tenant indicado no existe.");

        if (!tenant.IsActive)
            throw new InvalidOperationException("No se puede asignar un usuario a un tenant inactivo.");

        return tenant;
    }

    private async Task<List<TenantDto>> BuildTenantDtosAsync(IEnumerable<Tenant> tenants)
    {
        var userCounts = await _unitOfWork.Users.CountGroupedByTenantAsync();
        var patientCounts = await _unitOfWork.Patients.CountGroupedByTenantAsync();
        var activeCounts = await _unitOfWork.Users.CountLoggedInSinceGroupedByTenantAsync(DateTime.UtcNow.AddDays(-30));

        return tenants.Select(t => ToTenantDto(
                t,
                userCounts.GetValueOrDefault(t.Id),
                patientCounts.GetValueOrDefault(t.Id),
                activeCounts.GetValueOrDefault(t.Id)))
            .ToList();
    }

    private async Task<TenantDto> BuildTenantDtoAsync(Tenant tenant)
        => (await BuildTenantDtosAsync([tenant]))[0];

    private static TenantDto ToTenantDto(Tenant t, int userCount, int patientCount, int activeLast30)
        => new()
        {
            Id = t.Id,
            Name = t.Name,
            Slug = t.Slug,
            Description = t.Description,
            LogoUrl = t.LogoUrl,
            IsActive = t.IsActive,
            UserCount = userCount,
            PatientCount = patientCount,
            ActiveUsersLast30Days = activeLast30,
            LastActivityAt = t.UpdatedAt,
            CreatedAt = t.CreatedAt
        };

    private static AdminUserDto ToAdminUserDto(ApplicationUser u, string? tenantName)
        => new()
        {
            Id = u.Id,
            Email = u.Email ?? string.Empty,
            FullName = u.FullName,
            Role = u.Role.ToString(),
            TenantId = u.TenantId,
            TenantName = u.TenantId.HasValue ? tenantName : null,
            IsActive = u.Status == UserStatus.Active,
            CreatedAt = u.CreatedAt,
            LastLoginAt = u.LastLoginAt
        };

    private static UserRole ParseRole(string? role)
    {
        if (!string.IsNullOrWhiteSpace(role)
            && !int.TryParse(role, out _)
            && Enum.TryParse<UserRole>(role.Trim(), ignoreCase: true, out var parsed)
            && Enum.IsDefined(parsed))
            return parsed;

        throw new InvalidOperationException(
            $"Rol inválido. Valores permitidos: {string.Join(", ", Enum.GetNames<UserRole>())}.");
    }

    private static string RequireTenantName(string? name)
    {
        var trimmed = (name ?? string.Empty).Trim();
        if (trimmed.Length == 0)
            throw new InvalidOperationException("El nombre del tenant es obligatorio.");
        if (trimmed.Length > 150)
            throw new InvalidOperationException("El nombre del tenant no puede superar 150 caracteres.");
        return trimmed;
    }

    private static (string FirstName, string LastName) SplitFullName(string? fullName)
    {
        var parts = (fullName ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0)
            throw new InvalidOperationException("El nombre completo es obligatorio.");

        var first = parts[0];
        var last = string.Join(' ', parts.Skip(1));
        if (first.Length > 100 || last.Length > 100)
            throw new InvalidOperationException("El nombre completo es demasiado largo.");
        return (first, last);
    }

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>Minúsculas, sin acentos, solo [a-z0-9] separados por guiones.</summary>
    private static string Slugify(string value)
    {
        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        var lastWasDash = false;

        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;

            if (c is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                sb.Append(c);
                lastWasDash = false;
            }
            else if (!lastWasDash && sb.Length > 0)
            {
                sb.Append('-');
                lastWasDash = true;
            }
        }

        var slug = sb.ToString().Trim('-');
        return slug.Length > 150 ? slug[..150].Trim('-') : slug;
    }

    private static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;
        try
        {
            return new MailAddress(email).Address == email;
        }
        catch
        {
            return false;
        }
    }
}
