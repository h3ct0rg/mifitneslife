namespace MyFitnessLife.Domain.Enums;

public enum UserRole
{
    SuperAdmin = 0,
    Admin = 1,
    Nutritionist = 2,
    Trainer = 3,
    Patient = 4
}

public enum UserStatus
{
    Active = 0,
    Inactive = 1,
    PendingInvitation = 2,
    Suspended = 3
}

public enum InvitationStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2,
    Expired = 3,
    Revoked = 4
}

public enum AppointmentStatus
{
    Scheduled = 0,
    Completed = 1,
    Cancelled = 2,
    NoShow = 3
}

public enum NotificationStatus
{
    Pending = 0,
    Sent = 1,
    Failed = 2
}