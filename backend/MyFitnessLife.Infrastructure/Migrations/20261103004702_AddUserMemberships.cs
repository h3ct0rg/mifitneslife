using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserMemberships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "MembershipId",
                table: "RefreshTokens",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LoginSelectionTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginSelectionTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoginSelectionTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserMemberships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Role = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserMemberships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserMemberships_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserMemberships_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoginSelectionTokens_TokenHash",
                table: "LoginSelectionTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoginSelectionTokens_UserId",
                table: "LoginSelectionTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMemberships_TenantId_Role",
                table: "UserMemberships",
                columns: new[] { "TenantId", "Role" });

            migrationBuilder.CreateIndex(
                name: "IX_UserMemberships_UserId_TenantId_Role",
                table: "UserMemberships",
                columns: new[] { "UserId", "TenantId", "Role" },
                unique: true);

            // Backfill (AC-1): 1 membresía por usuario existente desde su Role/TenantId actual.
            // - SuperAdmin (Role = 0) → TenantId NULL aunque tuviera uno residual.
            // - Resto → solo si su tenant existe (sin tenant válido no hay membresía posible).
            // - Status de la membresía = Active; el estado de la cuenta sigue en AspNetUsers.Status.
            // - LastUsedAt = último login, para que la por defecto sea la que ya usaban.
            // Idempotente (NOT EXISTS) por si se reaplica.
            migrationBuilder.Sql(@"
INSERT INTO [UserMemberships] ([Id], [UserId], [TenantId], [Role], [Status], [CreatedAt], [LastUsedAt])
SELECT NEWID(),
       u.[Id],
       CASE WHEN u.[Role] = 0 THEN NULL ELSE u.[TenantId] END,
       u.[Role],
       0,
       u.[CreatedAt],
       u.[LastLoginAt]
FROM [AspNetUsers] u
WHERE (u.[Role] = 0
       OR (u.[TenantId] IS NOT NULL AND EXISTS (SELECT 1 FROM [Tenants] t WHERE t.[Id] = u.[TenantId])))
  AND NOT EXISTS (SELECT 1 FROM [UserMemberships] m WHERE m.[UserId] = u.[Id]);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoginSelectionTokens");

            migrationBuilder.DropTable(
                name: "UserMemberships");

            migrationBuilder.DropColumn(
                name: "MembershipId",
                table: "RefreshTokens");
        }
    }
}
