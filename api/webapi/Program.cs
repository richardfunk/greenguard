using GreenGuard.WebApi.Hubs;
using GreenGuard.WebApi.Services;


var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────────────────────

builder.Services.AddControllers();

// In-memory store (singleton so all requests share state)
builder.Services.AddSingleton<IDataStore, InMemoryDataStorageService>();

// Anomaly detection — singleton because it reads from the singleton store
builder.Services.AddSingleton<IAnomalyDetector, AnomalyDetectionService>();
builder.Services.AddSingleton<ReadingIngestionService>();

// SignalR
builder.Services.AddSignalR();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS — adjust origins to match your Angular dev server
builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:4200",   // Angular default dev port
                "https://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();           // Required for SignalR
    });
});

// ── Pipeline ──────────────────────────────────────────────────────────────────

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AngularClient");

app.UseRouting();
app.UseAuthorization();

app.MapControllers();

// SignalR hub endpoint — Angular SignalRService should connect to /hubs/sensor
app.MapHub<SensorHub>("/hubs/sensor");

app.Run();
