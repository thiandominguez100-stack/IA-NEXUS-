# NEXUS AI

Sala multiagente para coordinar conversaciones entre modelos reales. El objetivo del proyecto es mantener un modo de uso con **presupuesto de $0**: prioriza modelos abiertos ejecutados localmente y solo habilita proveedores cloud cuando exista un nivel gratuito adecuado.

## Funciones de esta versión

- Interfaz web para configurar tema, instrucción, participantes y rondas.
- Turnos secuenciales con historial compartido.
- Transcripción en directo y control para detener.
- Adaptadores para OpenAI, Anthropic, Gemini, xAI y DeepSeek (opcionales; requieren acceso API).
- Hasta tres participantes locales mediante Ollama, sin claves API.
- Qwen 2.5 1.5B configurado como primer participante local.

## Modo gratuito local

### Requisitos

- Node.js 20 o superior.
- Ollama instalado en la misma computadora que ejecuta NEXUS.
- Modelos pequeños compatibles con la memoria disponible.

Descarga Ollama desde https://ollama.com/ y abre la aplicación. Para el primer participante, descarga:

```bash
ollama pull qwen2.5:1.5b
```

Opcionalmente, para habilitar debates entre dos IA locales, descarga un segundo modelo pequeño:

```bash
ollama pull llama3.2:1b
```

Copia `.env.example` como `.env`. La configuración inicial ya indica Qwen como primer participante:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL_A=qwen2.5:1.5b
OLLAMA_MODEL_B=
```

Cuando descargues un segundo modelo, completa `OLLAMA_MODEL_B` con su nombre exacto, por ejemplo `llama3.2:1b`. Puedes probar NEXUS con un modelo; para que haya intercambio entre modelos selecciona al menos dos.

Ollama debe permanecer ejecutándose mientras uses NEXUS. La aplicación solicita a Ollama que descargue el modelo de memoria después de cada respuesta para reducir la presión de RAM; eso puede hacer más lentos los turnos siguientes.

En equipos con 8 GB de RAM, empieza con modelos de 1B a 1.5B parámetros y evita ejecutar muchas aplicaciones pesadas a la vez. El rendimiento depende del procesador, memoria disponible y cuantización del modelo.

## Instalación de NEXUS

1. Descarga este repositorio desde GitHub.
2. En la carpeta del proyecto ejecuta `npm install`.
3. Copia `.env.example` como `.env`.
4. Ejecuta `npm start`.
5. Abre `http://localhost:3000`.

## Proveedores cloud opcionales

Los adaptadores de OpenAI, Anthropic, Gemini, xAI y DeepSeek requieren claves API y modelos habilitados. Una aplicación de chat gratuita no garantiza API gratuita. No configures facturación ni introduzcas métodos de pago para cumplir el objetivo de presupuesto cero. Si un proveedor no ofrece acceso gratuito en tu cuenta, déjalo desactivado.

## Seguridad

- Nunca subas `.env` a GitHub.
- Nunca pegues claves API en la interfaz ni en el chat.
- Mantén el servidor local; no lo expongas a internet sin autenticación, HTTPS y controles adicionales.
- NEXUS coordina respuestas; no entrena ni replica los modelos.
