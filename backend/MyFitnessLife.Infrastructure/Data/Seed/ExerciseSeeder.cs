using Microsoft.EntityFrameworkCore;
using MyFitnessLife.Domain.Entities;
using MyFitnessLife.Domain.Enums;
using System.Reflection;
using System.Text.Json;

namespace MyFitnessLife.Infrastructure.Data.Seed;

public static class ExerciseSeeder
{
    private sealed class SeedExercise
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string BodyPart { get; set; } = string.Empty;
        public string Equipment { get; set; } = string.Empty;
        public string? Target { get; set; }
        public string? MuscleGroup { get; set; }
        public List<string>? SecondaryMuscles { get; set; }
        public SeedInstructions? Instructions { get; set; }
        public string? MediaId { get; set; }
        public string? Image { get; set; }
        public string? GifUrl { get; set; }
    }

    private sealed class SeedInstructions
    {
        public string? Es { get; set; }
    }

    // Traducciones categorías (body part)
    private static readonly Dictionary<string, string> Categories = new()
    {
        ["upper arms"] = "Brazos superiores",
        ["upper legs"] = "Piernas superiores",
        ["back"] = "Espalda",
        ["waist"] = "Cintura",
        ["chest"] = "Pecho",
        ["shoulders"] = "Hombros",
        ["lower legs"] = "Piernas inferiores",
        ["lower arms"] = "Antebrazos",
        ["cardio"] = "Cardio",
        ["neck"] = "Cuello"
    };

    // Traducciones equipamiento
    private static readonly Dictionary<string, string> Equipment = new()
    {
        ["body weight"] = "Peso corporal",
        ["dumbbell"] = "Mancuerna",
        ["cable"] = "Polea",
        ["barbell"] = "Barra",
        ["leverage machine"] = "Máquina",
        ["band"] = "Banda elástica",
        ["smith machine"] = "Máquina Smith",
        ["kettlebell"] = "Kettlebell",
        ["weighted"] = "Con peso",
        ["stability ball"] = "Balón suizo",
        ["ez barbell"] = "Barra Z",
        ["sled machine"] = "Máquina de trineo",
        ["assisted"] = "Asistido",
        ["medicine ball"] = "Balón medicinal",
        ["rope"] = "Cuerda",
        ["roller"] = "Rodillo",
        ["resistance band"] = "Banda de resistencia",
        ["bosu ball"] = "Bola Bosu",
        ["wheel roller"] = "Rueda",
        ["olympic barbell"] = "Barra olímpica",
        ["tire"] = "Llantas",
        ["trap bar"] = "Barra trampa",
        ["stepmill machine"] = "Stepmill",
        ["elliptical machine"] = "Elíptica",
        ["hammer"] = "Martillo",
        ["skierg machine"] = "Máquina de esquí",
        ["stationary bike"] = "Bicicleta estática",
        ["upper body ergometer"] = "Ergómetro superior"
    };

    // Traducciones músculos (target / muscle_group)
    private static readonly Dictionary<string, string> Muscles = new()
    {
        ["abductors"] = "Abductores",
        ["abs"] = "Abdominales",
        ["adductors"] = "Aductores",
        ["biceps"] = "Bíceps",
        ["calves"] = "Gemelos",
        ["cardiovascular system"] = "Sistema cardiovascular",
        ["delts"] = "Deltoides",
        ["forearms"] = "Antebrazos",
        ["glutes"] = "Glúteos",
        ["hamstrings"] = "Isquiotibiales",
        ["lats"] = "Dorsales",
        ["levator scapulae"] = "Elevador de la escápula",
        ["pectorals"] = "Pectorales",
        ["quads"] = "Cuádriceps",
        ["serratus anterior"] = "Serrato anterior",
        ["spine"] = "Columna",
        ["traps"] = "Trapecios",
        ["triceps"] = "Tríceps",
        ["upper back"] = "Espalda alta",
        ["abdominals"] = "Abdominales",
        ["ankle stabilizers"] = "Estabilizadores del tobillo",
        ["ankles"] = "Tobillos",
        ["chest"] = "Pecho",
        ["core"] = "Core",
        ["deltoids"] = "Deltoides",
        ["hands"] = "Manos",
        ["hip flexors"] = "Flexores de cadera",
        ["latissimus dorsi"] = "Dorsal ancho",
        ["lower back"] = "Espalda baja",
        ["obliques"] = "Oblicuos",
        ["quadriceps"] = "Cuádriceps",
        ["rhomboids"] = "Romboides",
        ["rotator cuff"] = "Manguito rotador",
        ["shoulders"] = "Hombros",
        ["soleus"] = "Sóleo",
        ["trapezius"] = "Trapecio",
        ["wrist extensors"] = "Extensores de muñeca",
        ["wrist flexors"] = "Flexores de muñeca",
        ["wrists"] = "Muñecas"
    };

    public static async Task SeedExercisesAsync(AppDbContext context)
    {
        var assembly = Assembly.GetExecutingAssembly();
        const string resourceName = "Infrastructure.Data.Seed.exercises.json";

        await using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream is null)
            return;

        var exercises = await JsonSerializer.DeserializeAsync<List<SeedExercise>>(stream, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        });

        if (exercises is null || exercises.Count == 0)
            return;

        // Banco de ejercicios global compartido por todos los tenants.
        var existing = await context.Exercises
            .ToDictionaryAsync(e => e.MediaId ?? e.Name);

        var now = DateTime.UtcNow;
        var changed = 0;

        foreach (var seed in exercises)
        {
            var key = string.IsNullOrWhiteSpace(seed.MediaId) ? seed.Name : seed.MediaId;
            var exercise = existing.GetValueOrDefault(key);

            if (exercise is null)
            {
                exercise = new Exercise
                {
                    Status = UserStatus.Active,
                    CreatedAt = now
                };
                context.Exercises.Add(exercise);
            }

            exercise.Name = seed.Name;
            exercise.Category = Translate(seed.Category, Categories);
            exercise.BodyPart = Translate(seed.Category, Categories);
            exercise.Equipment = Translate(seed.Equipment, Equipment);
            exercise.Target = Translate(seed.Target, Muscles);
            exercise.MuscleGroup = Translate(seed.MuscleGroup, Muscles);
            exercise.SecondaryMuscles = seed.SecondaryMuscles is { Count: > 0 }
                ? string.Join(", ", seed.SecondaryMuscles.Select(s => Translate(s, Muscles)))
                : null;
            exercise.Instructions = string.IsNullOrWhiteSpace(seed.Instructions?.Es) ? null : seed.Instructions.Es;
            exercise.MediaId = seed.MediaId;

            // Solo sembrar las rutas relativas fuente si aún no se importaron a Minio
            // (no pisar URLs ya importadas: "exercises/xxxx.gif" o "http...").
            if (string.IsNullOrEmpty(exercise.ImageUrl) || exercise.ImageUrl.StartsWith("images/", StringComparison.OrdinalIgnoreCase))
                exercise.ImageUrl = seed.Image;
            if (string.IsNullOrEmpty(exercise.GifUrl) || exercise.GifUrl.StartsWith("videos/", StringComparison.OrdinalIgnoreCase))
                exercise.GifUrl = seed.GifUrl;

            exercise.UpdatedAt = now;

            changed++;
        }

        if (changed > 0)
            await context.SaveChangesAsync();
    }

    private static string Translate(string? value, Dictionary<string, string> map)
        => string.IsNullOrWhiteSpace(value) ? string.Empty
            : map.TryGetValue(value.ToLowerInvariant(), out var translation) ? translation : value;
}