using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionsAndLoginEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Method",
                table: "LoginSelectionTokens",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LoginEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    MembershipId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Role = table.Column<int>(type: "int", nullable: false),
                    Method = table.Column<int>(type: "int", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UserAgent = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoginEvents_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LoginEvents_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SubscriptionPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DurationDays = table.Column<int>(type: "int", nullable: false),
                    PriceUsd = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    IsTrial = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionPlans", x => x.Id);
                    table.CheckConstraint("CK_SubscriptionPlans_DurationDays", "[DurationDays] > 0");
                    table.CheckConstraint("CK_SubscriptionPlans_PriceUsd", "[PriceUsd] >= 0");
                });

            migrationBuilder.CreateTable(
                name: "TenantSubscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlanName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PriceUsd = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    StartsAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantSubscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantSubscriptions_SubscriptionPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "SubscriptionPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantSubscriptions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoginEvents_OccurredAt",
                table: "LoginEvents",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_LoginEvents_TenantId",
                table: "LoginEvents",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_LoginEvents_UserId_OccurredAt",
                table: "LoginEvents",
                columns: new[] { "UserId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionPlans_IsTrial",
                table: "SubscriptionPlans",
                column: "IsTrial",
                unique: true,
                filter: "[IsTrial] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionPlans_Name",
                table: "SubscriptionPlans",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantSubscriptions_PlanId",
                table: "TenantSubscriptions",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantSubscriptions_TenantId_StartsAt",
                table: "TenantSubscriptions",
                columns: new[] { "TenantId", "StartsAt" });

            // AC-1 / U2: planes iniciales (USD, editables). Ids fijos; idempotente por nombre.
            migrationBuilder.Sql(@"
INSERT INTO [SubscriptionPlans] ([Id], [Name], [DurationDays], [PriceUsd], [IsTrial], [IsActive], [SortOrder], [CreatedAt], [UpdatedAt])
SELECT v.[Id], v.[Name], v.[DurationDays], v.[PriceUsd], v.[IsTrial], 1, v.[SortOrder], SYSUTCDATETIME(), NULL
FROM (VALUES
    (CAST('5a1d0000-0000-4000-8000-000000000001' AS uniqueidentifier), N'Free trial', 30, CAST(0 AS decimal(10,2)), CAST(1 AS bit), 0),
    (CAST('5a1d0000-0000-4000-8000-000000000002' AS uniqueidentifier), N'Mensual', 30, CAST(12 AS decimal(10,2)), CAST(0 AS bit), 1),
    (CAST('5a1d0000-0000-4000-8000-000000000003' AS uniqueidentifier), N'Trimestral', 90, CAST(33 AS decimal(10,2)), CAST(0 AS bit), 2),
    (CAST('5a1d0000-0000-4000-8000-000000000004' AS uniqueidentifier), N'Semestral', 180, CAST(62 AS decimal(10,2)), CAST(0 AS bit), 3),
    (CAST('5a1d0000-0000-4000-8000-000000000005' AS uniqueidentifier), N'Anual', 365, CAST(115 AS decimal(10,2)), CAST(0 AS bit), 4)
) AS v([Id], [Name], [DurationDays], [PriceUsd], [IsTrial], [SortOrder])
WHERE NOT EXISTS (SELECT 1 FROM [SubscriptionPlans] p WHERE p.[Name] = v.[Name]);
");

            // AC-4 / U4: cada tenant existente recibe el trial desde la aplicación de la migración
            // (CreatedBy NULL = sistema). Idempotente: solo tenants sin ninguna suscripción.
            migrationBuilder.Sql(@"
INSERT INTO [TenantSubscriptions] ([Id], [TenantId], [PlanId], [PlanName], [PriceUsd], [StartsAt], [EndsAt], [CreatedAt], [CreatedBy], [Note])
SELECT NEWID(), t.[Id], p.[Id], p.[Name], p.[PriceUsd], SYSUTCDATETIME(), DATEADD(day, p.[DurationDays], SYSUTCDATETIME()), SYSUTCDATETIME(), NULL, NULL
FROM [Tenants] t
CROSS JOIN [SubscriptionPlans] p
WHERE p.[IsTrial] = 1
  AND NOT EXISTS (SELECT 1 FROM [TenantSubscriptions] s WHERE s.[TenantId] = t.[Id]);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoginEvents");

            migrationBuilder.DropTable(
                name: "TenantSubscriptions");

            migrationBuilder.DropTable(
                name: "SubscriptionPlans");

            migrationBuilder.DropColumn(
                name: "Method",
                table: "LoginSelectionTokens");
        }
    }
}
