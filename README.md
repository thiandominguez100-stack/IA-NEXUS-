# NEXUS AI

Sala multiagente para conversar con modelos de IA reales mediante las APIs oficiales de cada proveedor.

## Estado actual

Primera versión funcional de la interfaz y del orquestador:
- Selección de 2 a 5 proveedores.
- Turnos secuenciales y rondas configurables.
- Transcripción compartida: cada participante recibe el historial anterior.
- Controles para iniciar y detener una conversación.
- Claves API solo en el servidor.
- Errores de proveedor y límites básicos de solicitudes.

## Proveedores

- OpenAI / ChatGPT — Responses API
- Anthropic / Claude — Messages API
- Google / Gemini — generateContent
- xAI / Grok — API compatible con Chat Completions
- DeepSeek — API compatible con Chat Completions

La conexión real requiere una clave API válida y un identificador de modelo habilitado por cada proveedor. Los nombres de modelo se configuran en el entorno porque la disponibilidad cambia según la cuenta y el proveedor.

## Requisitos

- Node.js 20 o superior
- Claves API de al menos dos proveedores para iniciar un debate

## Instalación local

1. Clona el repositorio.
2. Instala dependencias:

   `npm install`

3. Copia `.env.example` como `.env`.
4. Completa las claves y los identificadores de modelo que tengas habilitados.
5. Inicia el servidor:

   `npm start`

6. Abre `http://localhost:3000`.

## Seguridad

- No subas el archivo `.env` a GitHub.
- No introduzcas claves API en el navegador.
- Si se publica el servidor en internet, configura `ADMIN_TOKEN`, HTTPS, autenticación de usuario, límites de uso y controles de presupuesto.
- Las APIs pueden tener costos, cuotas y restricciones independientes de las aplicaciones de chat gratuitas.

## Variables principales

Consulta `.env.example` para ver todas las variables. `MAX_ROUNDS` limita las rondas del debate y `MAX_OUTPUT_TOKENS` limita la longitud solicitada a cada modelo.

## Alcance

NEXUS AI coordina conversaciones entre modelos. No entrena ni replica esos modelos: envía solicitudes a los servicios oficiales y muestra sus respuestas.
