using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MakeFoodsGlobal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Foods_TenantId_Name",
                table: "Foods");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Foods");

            migrationBuilder.CreateIndex(
                name: "IX_Foods_Name",
                table: "Foods",
                column: "Name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Foods_Name",
                table: "Foods");

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "Foods",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_Foods_TenantId_Name",
                table: "Foods",
                columns: new[] { "TenantId", "Name" },
                unique: true);
        }
    }
}
