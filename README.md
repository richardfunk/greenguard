# Greenhouse Monitor Dashboard and WebAPI

Real-time sensor monitoring dashboard built with Angular 17, TypeScript, RxJS, and Chart.js.
Connects to the GreenGuard.WebApi backend via SignalR and REST.

.NET 8 Web API for ingesting greenhouse sensor readings, detecting anomalies, and broadcasting real-time updates via SignalR.

## Quick start

To run the webapi:

```bash
cd api/webapi
dotnet run
```

Swagger UI is available at `/swagger` in Development mode.


To run the UI:

```bash
cd ui
npm install
npm start
# Opens at http://localhost:4200
```

## Connecting to the API

The `apiBaseUrl` in `src/environments/environment.ts` must point to your running SensorApi instance.

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000'   // ← change if API runs on a different port/host
};
```

## Connecting to the UI

http://localhost:4200


## To populate the web api with data

Use Postman or Insomnia. Post SensorReading objects to http://localhost:5000/api/readings. Test data can be found at api/webapi/GreenGuard.WebApi/TestData/sensor-readings.json


## Deficiencies

The offline queue has been implemented but isn't useful for how this web app works. The app 
doesn't post any data to the web api. The only get requests are on init and when connectivity is 
restored. Given that, it isn't actually clear that it works and it probably should just be deleted.

The online/reconnecting/offline indicator mostly works but there are some edge cases where it
doesn't correctly go from online -> reconnecting -> online again.

Starting/stopping the web api disrupts the connection from the web page and the web page needs a
hard reload to re-establish connectivity.
