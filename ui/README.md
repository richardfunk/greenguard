# Greenhouse Monitor Dashboard

Real-time sensor monitoring dashboard built with Angular 17, TypeScript, RxJS, and Chart.js.
Connects to the GreenGuard.WebApi backend via SignalR and REST.

## Quick start

```bash
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

SignalR hub URL is derived automatically: `${apiBaseUrl}/hubs/sensor`


## Deficiencies

The offline queue has been implemented but isn't useful for how this web app works. The app 
doesn't post any data to the web api. The only get requests are on init and when connectivity is 
restored. Given that, it isn't actually clear that it works and it probably should just be deleted.

The online/reconnecting/offline indicator mostly works but there are some edge cases where it
doesn't correctly go from online -> reconnecting -> online again.

Starting/stopping the web api disrupts the connection from the web page and the web page needs a
hard reload to re-establish connectivity.
