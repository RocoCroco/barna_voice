# Arquitectura del frontend

## Propósito

`frontend/` contiene la aplicación de Smart TV de Compass. Su objetivo es
validar la experiencia de Titan OS en navegador mientras no disponemos del
dispositivo: navegación con mando, foco a distancia, conversación por voz y
recomendaciones que cambian de forma comprensible.

La interfaz visible está en inglés. Esta documentación técnica está en español.

## Estado actual

### Implementado

- Selección de perfil desde `GET /api/users`; el identificador es el username.
- Home en dos escenas: voz primero y opciones secundarias debajo.
- `Room consensus` y `Decide for me` como entradas al flujo de voz.
- Navegación espacial con flechas, OK, Back y restauración del foco.
- Sesión de voz real mediante Pipecat Client y SmallWebRTC.
- Reproducción del audio remoto del agente en el navegador.
- Estados visuales de escucha, transcripción, pregunta y procesamiento.
- Fondo WebGL de sesión con Molten Metal persistente y Soft Aurora activa solo
  durante la conversación.
- Historial de transcripción escalonado bajo la esfera y reubicado al pie al
  mostrar resultados.
- Cuadrícula animada de hasta ocho recomendaciones reales del backend.
- Pausa y reanudación desde la esfera lateral.
- Detalle de contenido desde la caché de recomendaciones de la sesión.
- Respeto de `prefers-reduced-motion`.

### Pendiente

- Persistencia entre recargas del navegador.
- Catálogo y disponibilidad por proveedor.
- Acción final de reproducción o deep link.

## Stack

| Tecnología | Uso |
| --- | --- |
| React 19 | Componentes y ciclo de vida de las pantallas |
| TypeScript | Contratos entre UI, stores, servicios y voz |
| Vite | Desarrollo y build |
| React Router | Rutas y retorno entre pantallas |
| Zustand | Estado de perfil, voz y recomendaciones |
| Motion for React | Transiciones de escena, shared layout y stagger |
| OGL | Shaders WebGL adaptados de React Bits para los fondos de voz |
| Lucide | Iconos de interfaz |
| Plus Jakarta Sans Semibold | Tipografía visible |
| Pipecat Client JS | Cliente del agente de voz |
| SmallWebRTC Transport | Micrófono, audio remoto y canal en tiempo real |

## Estructura relevante

```text
frontend/
├── public/
│   ├── brand/                 # logotipo e icono de brújula
│   └── mocks/                 # referencias visuales de diseño
├── src/
│   ├── app/                   # router principal
│   ├── components/            # primitivas reutilizables para TV
│   ├── navigation/            # foco espacial y eventos del mando
│   ├── pages/                 # perfiles, Home, sesión y detalle
│   ├── services/              # API, adaptación de contenido y eventos tipados
│   ├── store/                 # stores Zustand separados por dominio
│   ├── styles/                # diseño global y estados visuales
│   ├── types/                 # contratos compartidos
│   └── voice/
│       ├── VoiceProvider.ts   # Pipecat/WebRTC y eventos de audio
│       └── useVoiceAgent.ts   # adaptación de la voz al estado de producto
├── .env.example
└── package.json
```

## Flujo de datos

```text
Page / Component
      │
      ├──► Zustand store ─────────► estado visible
      │
      ├──► service ───────────────► backend / caché de sesión
      │
      └──► useVoiceAgent
                │
                ▼
          VoiceProvider
                │
                ▼
       Pipecat + SmallWebRTC
                │
                ▼
        voice-agent :7860
```

Los componentes no deben llamar directamente al backend. `apiRequest()` añade
el `X-Profile-Id` activo y será la base de las integraciones HTTP. Del mismo
modo, los componentes no manejan WebRTC directamente: consumen
`useVoiceAgent()`, que traduce eventos técnicos a estados de producto.

## Sesión de voz real

Al pulsar `Press to talk`:

1. `VoiceProvider` inicializa los dispositivos antes de abrir una sesión de
   proveedor. Así evita gastar crédito si el micrófono está ocupado.
2. El frontend hace `POST /start` al agente local.
3. SmallWebRTC negocia la conexión y transmite el micrófono.
4. Los callbacks de Pipecat actualizan `voice.store`:
   `listening`, `processing`, `speaking`, `paused` o `disconnected`.
5. Las transcripciones parciales y el texto del agente aparecen como subtítulos.
6. La pista remota de audio se conecta a un elemento `<audio>` oculto y se
   reproduce por la salida predeterminada del televisor o navegador.

La URL se configura con:

```dotenv
VITE_VOICE_AGENT_URL=http://localhost:7860
```

Ninguna clave de SLNG o Nebius puede aparecer en variables `VITE_*`.

## Semántica de la esfera

La esfera es el control principal de toda la sesión:

- Sin recomendaciones visibles: pulsarla termina WebRTC, cierra el micrófono y
  vuelve a Home con transición.
- Con recomendaciones visibles y conversación activa: pulsarla pausa la escucha
  y mantiene los resultados en pantalla.
- Con recomendaciones pausadas: muestra `Resume` y reanuda la misma sesión.

Esto evita depender de un botón secundario y mantiene la interacción compatible
con un mando de televisión.

## Navegación TV

`FocusManager` calcula el siguiente elemento según su posición real en pantalla,
no según el orden del DOM. Los elementos interactivos exponen
`data-focusable="true"`; el foco inicial utiliza `data-focus-default="true"`.

Controles de navegador:

```text
ArrowUp / ArrowDown / ArrowLeft / ArrowRight  mover foco
Enter                                          seleccionar
Escape / BrowserBack                           volver
V                                              activar control de voz
```

Titan OS debe integrarse dentro de `src/platform/titan/`. El resto de React no
debe importar directamente un SDK de plataforma. La capa equivalente de
navegador permite continuar desarrollando sin el dispositivo.

## Recomendaciones y animación

Los modos se mapean a `discover → preference`, `consensus → room` y
`decide → decide` bajo `/api/content/`. `content.service.ts` adapta las
respuestas reales y conserva los detalles en una caché por sesión.
No existe un endpoint de detalle: recargar el navegador pierde esta caché.

El agente envía el evento por `onServerMessage` de Pipecat, sin interpretar
transcripciones:

```ts
interface RecommendationUpdate {
  type: 'recommendations.updated';
  sessionId: string;
  profileId: string;
  revision: number;
  message: string;
  criteria: string[];
  items: Array<{
    contentId: string;
    score: number;
    reason?: string;
  }>;
  catalog: BackendItem[];
}
```

`catalog` contiene los datos originales necesarios para resolver cada `contentId`;
`revision` descarta actualizaciones duplicadas o antiguas. También se valida el
perfil y la sesión antes de modificar la caché.

La UI conserva las tarjetas que siguen siendo válidas y anima entradas, salidas
y cambios de posición. La conversación WebRTC permanece abierta. Pausar silencia
micrófono y altavoz, y abrir el detalle conserva la lista y el foco para volver.
La selección persiste entre refinamientos. Salir a Home o perfiles cierra la sesión.

## Comandos

```powershell
cd frontend
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build
pnpm dev
```

El servidor de desarrollo usa `http://localhost:5173`. La preview de producción
puede iniciarse en el puerto `4173` después del build.

## Principios para la siguiente fase

- TV-first: legibilidad a distancia y foco antes que densidad de información.
- Voz visible: nunca escuchar de forma oculta.
- Animación funcional: comunicar cambios, no decorar sin propósito.
- Backend desacoplado: toda llamada pasa por servicios y contratos tipados.
- Seguridad: secretos exclusivamente en el agente o backend.
- Rendimiento: evitar dependencias y renders innecesarios en hardware de TV.
