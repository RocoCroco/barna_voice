# Product Flow — Titan OS Voice Recommendations

## Visión del producto

La aplicación ayuda a un hogar a decidir qué ver mediante una conversación natural.
No pretende ser únicamente otro catálogo de películas y series: su experiencia
principal consiste en hablar con un agente mientras las recomendaciones se
actualizan progresivamente en pantalla.

La navegación tradicional mediante mando seguirá existiendo y debe resultar
familiar. La parte diferencial del producto estará en la recomendación por voz.

### Estado de integración actual

La conversación de audio ya es real: navegador, WebRTC, SLNG STT, Nebius, SLNG
TTS y altavoces. Los perfiles, el catálogo y las rondas de recomendación siguen
siendo datos simulados detrás de servicios reemplazables. Por tanto, las
pantallas demuestran el flujo final, pero todavía no deben atribuirse al agente
los títulos que aparecen hasta conectar las herramientas del backend.

---

## Decisiones actuales

### Identidad del usuario

* La instalación representa una única cuenta asociada a esta TV.
* Esa cuenta puede contener varios perfiles y el usuario elegirá uno al abrir la
  aplicación.
* El frontend pedirá al backend los perfiles disponibles; no se introducirán
  cuentas alternativas ni un selector de cuenta.
* Tras la elección, el `profileId` se enviará como contexto en las llamadas
  posteriores al backend, incluidas las sesiones de recomendación.
* Cualquier persona de la casa podrá hablar con el agente.
* No se intentará identificar ni recordar individualmente a cada hablante.
* Las preferencias recogidas durante una conversación pertenecerán a esa sesión.

### Idioma del MVP

* Todo el texto visible de la aplicación estará inicialmente en inglés.
* La estructura permitirá introducir internacionalización más adelante sin que
  forme parte del alcance del primer MVP.

### Principio de interacción

La interfaz general será reconocible para un usuario de Smart TV:

* Flechas para desplazarse.
* `OK` para seleccionar.
* `Back` para volver manteniendo el foco anterior.
* Un botón de voz o una acción destacada para iniciar la conversación.

No se buscará innovar complicando estos controles. La creatividad se concentrará
en la conversación, la evolución visual de las recomendaciones y la reducción de
la fatiga al elegir contenido.

---

## Experiencia principal

El flujo principal es una sesión de recomendación por voz:

```text
Home
  ↓
Iniciar conversación
  ↓
El usuario explica qué le apetece
  ↓
Aparecen recomendaciones iniciales
  ↓
La conversación continúa
  ↓
Las recomendaciones se refinan en directo
  ↓
Pausar la conversación
  ↓
Revisar tranquilamente las opciones con el mando
  ↓
Abrir un detalle, reanudar la conversación o elegir contenido
```

### 1. Inicio

La Home tendrá una llamada a la acción principal para comenzar a hablar. Al
activarla, la aplicación entra en una sesión de recomendación claramente visible.
El agente nunca debe parecer que escucha de forma oculta.

Ejemplo:

> Queremos una película divertida para cuatro personas, que dure menos de dos
> horas y que no sea infantil.

### 2. Recomendaciones vivas

Mientras avanza la conversación, la aplicación mantiene una selección pequeña y
comprensible de candidatos. En el MVP, la vista viva utiliza un tablero de ocho
títulos (cuatro columnas por dos filas) para que el cambio de opciones sea fácil
de percibir a distancia. Los títulos con mayor afinidad aparecen primero.

Cuando el usuario pausa y entra en el detalle de la selección, las tres opciones
principales podrán explicar brevemente su papel en la recomendación:

* La opción más segura.
* La que mejor equilibra las preferencias expresadas.
* Una alternativa algo más inesperada.

Estas etiquetas son orientativas y podrán adaptarse al contexto de la petición.
La aplicación debe explicar por qué recomienda cada título sin mostrar texto
excesivo.

El usuario podrá refinar los resultados hablando de forma natural:

> Algo un poco más adulto.

> Que sea española.

> La segunda me gusta, pero quiero algo con más acción.

> Descarta todo lo que dure más de cien minutos.

Cuando cambien las recomendaciones, la transición debe ayudar a entender qué ha
ocurrido:

* Mantener en su sitio las opciones que todavía encajan.
* Sustituir de manera visible las descartadas.
* Mostrar brevemente el nuevo criterio entendido por el agente.
* Evitar reconstruir toda la pantalla en cada respuesta.

### 3. Pausa para explorar

El usuario podrá decir expresiones como:

> Para un momento.

> Déjame ver estas opciones.

> Quiero mirarlas tranquilamente.

Esto congela la selección actual y pasa a un modo de exploración mediante mando:

* Las recomendaciones dejan de cambiar.
* El estado de escucha activa finaliza o queda claramente pausado.
* El foco se sitúa en la primera recomendación relevante.
* El usuario puede recorrer opciones y abrir sus detalles.
* Volver desde un detalle restaura el mismo candidato y la misma sesión.

Desde este estado se podrá reanudar la conversación con una orden como:

> Sigamos buscando.

> Quiero cambiar una cosa.

> Busca algo parecido a esta, pero más corto.

La selección, los criterios y el contexto anteriores deben conservarse al
reanudar la sesión.

### Composición visual de la sesión en el MVP

La sesión elimina temporalmente la navegación superior para mantener el foco en
la conversación y utiliza dos composiciones:

1. `Listening`: logotipo en la esquina superior izquierda, icono de brújula y
   control circular en el centro. El texto `Just talk it out…` refuerza que no es
   necesario aprender comandos.
2. `Live recommendations`: tablero 4×2 a la izquierda y un rail conversacional a
   la derecha. El control circular muestra `Pause` mientras la conversación está
   activa y `Resume` cuando se congela.

En la implementación actual, la conversación de la bola grande ya utiliza el
agente real. Antes de mostrar contenido, la misma composición puede alternar
entre:

* `Listening`: escucha activa y pulso ambiental azul.
* `Live transcript`: texto reconocido mostrado como un subtítulo temporal.
* `Agent question`: una pregunta breve del agente sin abandonar la escena de voz.
* `Thinking`: estado de procesamiento previo a una respuesta.

Cuando el backend emita recomendaciones estructuradas, la pantalla cambiará al
tablero sin cerrar la sesión WebRTC. La bola grande se transformará entonces en
el control lateral pequeño mediante una transición compartida. Las tarjetas
aparecen de forma escalonada para comunicar que son el resultado de la
conversación. Hasta que exista ese contrato, la transición al tablero se activa
con atajos de demo y utiliza contenido simulado.

Al pulsar `Pause`, el foco pasa automáticamente a la primera recomendación; el
usuario puede navegar con el mando y llegar a `Resume` para continuar hablando.
El foco y todos los estados activos utilizan el azul cian de la marca.

#### Atajos temporales de simulación

Hasta conectar el agente de voz, la ruta de recomendaciones expone estos estados
con teclas numéricas:

* `1`: escucha inicial.
* `2`: transcripción en directo.
* `3`: pregunta del agente.
* `4`: procesamiento y llegada de recomendaciones.
* `5`: refinar y reordenar las recomendaciones visibles.

`Enter` sobre la bola grande detiene la conversación y vuelve a Home cuando aún
no hay resultados. Sobre la bola lateral pausa la escucha conservando las
recomendaciones, o la reanuda cuando muestra `Resume`. Los atajos numéricos son
solo una herramienta de desarrollo y se sustituirán por eventos estructurados
del agente y del backend.

Las transiciones de composición usan Motion for React y los pulsos continuos se
resuelven con CSS. La interfaz respeta `prefers-reduced-motion` para reducir tanto
las transiciones como los bucles decorativos cuando el sistema lo solicita. El
pequeño barrido de la aguja entre −30° y +30° se conserva porque comunica que el
agente sigue buscando y no desplaza contenido de la interfaz.

---

## Estados de la sesión de voz

```text
INACTIVA
   │ iniciar
   ▼
ESCUCHANDO ◄──────────────┐
   │ mensaje completo     │ reanudar
   ▼                      │
PROCESANDO                │
   │ respuesta            │
   ▼                      │
CONVERSANDO ──────────────┤
   │ nuevos criterios     │
   ├────────► PROCESANDO  │
   │                      │
   │ pausar               │
   ▼                      │
EXPLORANDO ───────────────┘
   │
   ├── abrir detalle
   ├── elegir contenido
   └── terminar sesión
```

La interfaz deberá diferenciar visualmente estos estados. El usuario tiene que
saber siempre si el agente está escuchando, pensando, hablando o pausado.

---

## Home

La Home combinará el acceso al agente con una navegación convencional.

### Composición en dos escenas

La Home se organiza como dos vistas verticales conectadas mediante el mando:

1. La primera escena ocupa toda la pantalla y muestra únicamente el logotipo de
   Compass, la pregunta `What do you want to watch?` y el botón circular
   `Press to talk`. Este botón recibe el foco inicial.
2. Al pulsar la flecha hacia abajo, la interfaz se desplaza con una animación
   suave y enfoca la primera opción de la segunda escena.
3. La segunda escena reúne `Room consensus`, `Decide for me` y una fila de
   recomendaciones básicas bajo `Ideas for tonight`.
4. Desde la primera opción, la flecha hacia arriba devuelve al botón de voz y a
   la escena inicial.

La portada no mostrará una barra de navegación tradicional. Su simplicidad debe
hacer evidente que hablar es la acción principal.

### Acción principal

El elemento protagonista será iniciar o retomar una recomendación por voz. Puede
acompañarse de una frase contextual, por ejemplo:

> ¿Qué os apetece ver hoy?

### Opciones secundarias

Dos accesos de menor tamaño reutilizarán la misma experiencia conversacional:

#### Consenso del salón

Pensado para varias personas que quieren encontrar una opción común.

* El agente pide a cada persona que exprese lo que le apetece.
* No identifica ni crea perfiles para los participantes.
* Mantiene las preferencias de cada intervención solo durante la sesión.
* Busca coincidencias y explica los compromisos realizados.
* Permite seguir refinando, pausar y explorar igual que el flujo principal.

Ejemplo:

> Una persona quiere comedia, otra ciencia ficción y nadie quiere algo de más de
> dos horas.

#### Decide por nosotros

Pensado para reducir al máximo el tiempo dedicado a elegir.

* El agente hace pocas preguntas, solo cuando son necesarias.
* Presenta tres finalistas.
* Permite un último refinamiento por voz.
* Reduce la selección a una recomendación final y explica brevemente por qué.
* El usuario conserva siempre la posibilidad de ver las otras opciones.

### Catálogo tradicional

Debajo de las experiencias de voz podrán aparecer filas convencionales como:

* Para esta noche.
* Tendencias.
* Continúa viendo.
* Selecciones por género o ambiente.

Estas filas son una alternativa útil, pero no deben competir visualmente con la
acción principal de voz.

---

## Navegación entre pantallas

```text
                         ┌─────────────────────┐
                         │ Consenso del salón  │
                         └──────────┬──────────┘
                                    │
┌────────┐     ┌────────────────────▼──┐     ┌──────────────────────┐
│  Home  ├────►│ Sesión de recomendación├────►│ Explorar selección  │
└───┬────┘     └────────────────────▲──┘     └──────────┬───────────┘
    │                               │                   │
    │            ┌──────────────────┴──┐                ▼
    │            │ Decide por nosotros │       ┌──────────────────┐
    │            └─────────────────────┘       │ Detalle contenido│
    │                                          └─────────┬────────┘
    ▼                                                    │
┌──────────────┐                                         ▼
│ Catálogo     │                                  Elegir / reproducir
│ tradicional  │
└──────────────┘
```

---

## Comportamiento visual

La conversación debe sentirse integrada en el contenido, no como un chatbot
superpuesto sobre la aplicación.

* El agente tendrá una presencia visual discreta pero reconocible.
* El fondo podrá adaptarse suavemente al tono de la recomendación.
* Los criterios entendidos aparecerán como información breve y temporal.
* Las tarjetas se reorganizarán con movimiento coherente y contenido estable.
* La animación comunicará cambios; no se utilizará solo como decoración.
* Se respetará una opción de movimiento reducido.
* La legibilidad a distancia y el rendimiento tendrán prioridad sobre los efectos.

---

## Alcance inicial

La primera versión demostrable debe validar el ciclo principal:

1. Obtener del backend los perfiles de la única cuenta de la TV.
2. Elegir un perfil y conservar su identificador como contexto activo.
3. Entrar en la Home e iniciar una conversación real por WebRTC.
4. Mostrar un tablero inicial de recomendaciones ordenado por afinidad.
5. Añadir o cambiar criterios mediante nuevas intervenciones.
6. Actualizar y reordenar las recomendaciones visualmente.
7. Pausar la conversación.
8. Navegar por la selección con el mando.
9. Abrir un detalle y volver conservando el foco.
10. Reanudar la conversación manteniendo el contexto.

`Consenso del salón` y `Decide por nosotros` aparecerán en la Home. Inicialmente
pueden compartir el mismo motor simulado y diferenciarse mediante sus prompts,
preguntas y estrategia de selección.

---

## Pendiente de decidir

* Qué ocurre exactamente al elegir `Reproducir`: reproducción interna o apertura
  del proveedor donde esté disponible el contenido.
* Cómo se activa la voz en el mando real de Titan OS.
* Duración y formato del historial de una sesión.
* Si el contexto doméstico proporcionado por la TV persistirá preferencias entre
  sesiones en una fase posterior.
* Palabras y expresiones finales para pausar, reanudar y terminar, procurando que
  el agente también entienda variaciones naturales.
