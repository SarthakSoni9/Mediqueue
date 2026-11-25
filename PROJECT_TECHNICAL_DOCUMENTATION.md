# Medi-Queue Technical Documentation

This document summarizes the languages, tools, APIs, and development skills used in Medi-Queue. It is based on the current source code and package configuration.

## What the project does

Medi-Queue is a web application for hospital appointment and queue workflows. It includes patient and staff portals, queue and doctor dashboards, teleconsultation booking, medical document intake, voice-assisted symptom intake, hospital discovery, maps, and accessibility requests.

## Languages and web technologies

- **TypeScript** — frontend components, shared data types, API services, and the Express server.
- **HTML** — the application entry document in `index.html`.
- **CSS** — global styling in `src/index.css`, with utility styling provided by Tailwind CSS.
- **JavaScript (ES modules)** — the runtime/module format used by the TypeScript application and build tools.

## Frameworks and libraries

- **React 19** and **React DOM** — component-based user interface.
- **Vite** — local development server and production bundler.
- **Tailwind CSS 4** — utility-first styling, integrated through the Vite plugin.
- **Express 4** — Node.js server and REST API routing (`server.ts`, `src/api/routes.ts`).
- **Firebase JavaScript SDK** — authentication and Cloud Firestore data access.
- **MongoDB Node.js driver** — doctor clinical history, prescriptions, and consultation workflows.
- **Google Gen AI SDK** — Gemini model calls for document extraction and voice/audio intake.
- **Leaflet** — interactive map display; **Google Maps** support is also included.
- **Motion** — interface animation; **Lucide React** — icons.
- **Multer**, **pdf-parse**, and **jsPDF** — file uploads, PDF text extraction, and PDF export.
- **Canvas Confetti** — confirmation effects.

## APIs and external services

| Service/API | Use in Medi-Queue | Configuration or notes |
| --- | --- | --- |
| **Firebase Authentication** | Google sign-in for patients and email/password authentication for staff, including password reset. | Firebase project configuration is read from `firebase-applet-config.json`; Google sign-in must be enabled in Firebase. |
| **Cloud Firestore** | Patient profiles, queue and doctor data, wheelchair requests, staff profiles, and rescheduling records; supports live snapshots. | Firestore must be enabled and access rules configured. See `firestore.rules`. |
| **Google Gemini API** | Clinical document field extraction and structuring/transcription of voice intake. | Set `GEMINI_API_KEY` (or supported `AI_API_KEY`) on the server. |
| **Medi-Queue Express REST API** | Application endpoints for medical document extraction, intake, nearby labs, teleconsult booking, and doctor workflows. | Mounted under `/api`; the server is started with `npm start`. Routes are in `src/api/routes.ts`. |
| **MongoDB** | Doctor consultations, prescriptions, and medical history services. | Set `MONGODB_URI`; the code has in-memory fallback data for some clinical records. |
| **Google Maps** | Map display/directions and the Google Maps component integration. | The Google Maps React integration is included. Any required Maps key should be configured for the deployment. |
| **OpenStreetMap / Leaflet** | Map tiles and interactive hospital/lab maps. | Uses OpenStreetMap tile servers and Leaflet loaded by the map UI. Follow the providers' attribution and usage requirements. |
| **Nominatim** | Address/place search used by the map interface. | Public OpenStreetMap geocoding endpoint. |
| **OSRM** | Route geometry and driving distance/duration lookup. | Uses the public `router.project-osrm.org` endpoint. |
| **Browser Web Speech API** | Speech recognition and spoken wayfinding guidance where supported by the browser. | Availability and language support depend on the browser/device. |

Some directory contents are local demo/reference data rather than live APIs. For example, nearby diagnostic centers and hospital listings are maintained in `src/data/labsData.ts` and `src/data/hospitalsData.ts`.

## API route groups

The Express router is mounted at `/api`. Current route groups include:

- `/api/intake/*` — transcript structuring and audio upload/transcription.
- Medical document upload/extraction routes — parse patient details from supported image/PDF files.
- `/api/labs/nearby` — find internal and nearby diagnostic centers.
- `/api/teleconsult/*` — teleconsultation booking and payment-verification workflow endpoints.
- `/api/doctor/*` — consultations, call-next-patient, prescriptions, and patient history.

For exact paths, request fields, and response shapes, see `src/api/routes.ts` and the service modules under `src/api/services/`.

## Development skills represented by the codebase

- Building reusable, typed interfaces with React and TypeScript.
- Managing client-side state, forms, dialogs, navigation, and role-specific dashboards.
- Designing and consuming JSON REST APIs with Express and `fetch`.
- Integrating authentication and real-time/cloud data storage with Firebase.
- Connecting Node.js services to MongoDB and handling fallback data.
- Working with AI model APIs, structured prompts, file upload, PDF parsing, and audio input.
- Building map interfaces with geolocation, geocoding, map tiles, and route services.
- Applying responsive UI styling, accessibility affordances, and interaction feedback.
- Configuring and running a Vite/TypeScript application and a Node.js production server.

## Useful project files

- `package.json` — commands and dependencies.
- `src/App.tsx` and `src/components/` — application flow and UI.
- `src/api/routes.ts` and `src/api/services/` — server endpoints and integrations.
- `src/firebase.ts` — Firebase initialization and data operations.
- `src/types/index.ts` — shared TypeScript data models.
- `firebase-applet-config.json` — Firebase web project configuration.
- `.env.example` — example server environment variables.
- `firestore.rules` — Firestore security rules.

## Running the project

```bash
npm install
npm run dev       # Vite development server
npm run build     # Production frontend bundle
npm start         # Express server (serves API and built frontend)
```

Set the Firebase configuration and required server secrets before using connected services. Refer to `README.md` for Firebase setup and deployment notes.
