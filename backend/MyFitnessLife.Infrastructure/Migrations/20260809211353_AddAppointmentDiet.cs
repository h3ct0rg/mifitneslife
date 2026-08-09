using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAppointmentDiet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DietId",
                table: "Appointments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_DietId",
                table: "Appointments",
                column: "DietId");

            migrationBuilder.AddForeignKey(
                name: "FK_Appointments_Diets_DietId",
                table: "Appointments",
                column: "DietId",
                principalTable: "Diets",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Appointments_Diets_DietId",
                table: "Appointments");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_DietId",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "DietId",
                table: "Appointments");
        }
    }
}
