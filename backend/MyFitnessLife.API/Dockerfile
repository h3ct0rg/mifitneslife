# Build context: ./backend (ver docker-compose.yml)

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY MyFitnessLife.API/API.csproj MyFitnessLife.API/
COPY MyFitnessLife.Application/Application.csproj MyFitnessLife.Application/
COPY MyFitnessLife.Domain/Domain.csproj MyFitnessLife.Domain/
COPY MyFitnessLife.Infrastructure/Infrastructure.csproj MyFitnessLife.Infrastructure/
RUN dotnet restore MyFitnessLife.API/API.csproj

COPY . .
# appsettings.json no se versiona: la imagen usa la plantilla sin secretos (los valores llegan por variables de entorno)
RUN cp MyFitnessLife.API/appsettings.example.json MyFitnessLife.API/appsettings.json
RUN dotnet publish MyFitnessLife.API/API.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "API.dll"]
