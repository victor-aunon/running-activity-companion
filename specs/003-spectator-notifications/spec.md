# Feature Specification: Sistema de Notificaciones Web y Experiencia del Espectador

**Feature Branch**: `003-spectator-notifications`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Quiero agregar notificaciones en la web. En principio creo que sólo se han de implementar en la web. Esto es lo que quiero como ESPECTADOR: - No quiero ver el input del pin en el muro de ánimos, si ya he conseguido acceder al dashboard, no necesito volver e introducir un pin ahí - Quiero recibir las siguientes notificaciones como espectador: - Que me notifique (snackbar en la webapp y notificación en el browser) cuando el corredor lleve el 25% del recorrido. Para esto vamos a setear la distancia de la carrera de la misma manera que con el ritmo. Se introduce en la app de Android y se toma como fallback una variable de entorno en la web - Que me notifique del mismo modo que antes cuando el corredor haya completado el 50% del recorrido - Que me notifique del mismo modo cuando el corredor haya completado el 75% del recorrido - Si las pulsaciones por minuto del corredor pasan de un determinado límite, que me avise que {{corredor}} está haciendo un esfuerzo. No se vuelve a comprobar hasta pasados 30 segundos. Si las pulsaciones siguen por encima de ese límite, se vuelve a enviar esta notificación hasta 3 seguidas consecutivas. - Si las pulsaciones por minuto pasan un umbral y los pasos por minuto también, quiero que se me avise de que el corredor está sprintando (probablemente el sprint final) y me impulse a enviarle un ánimo. Esta notificación sólo se envía una vez si quedan menos de 2km para el final de la carrera. De lo contrario se siguen las reglas de antes: se comprueba cada 30 segundos y sólo se envían 3 consecutivas. - Si, como espectador, me he unido tarde a la carrera, no quiero recibir las notificaciones previas. Tan sólo si el corredor está en un esfuerzo o en el sprint. Añade lo siguiente: - En la pantalla de acceso, quiero que se inste al usuario a activar notificaciones en el browser. Que no le venga el aviso después - Añade en el test-runner la forma manual de probar los avisos: pulsar una tecla específica para avanzar 1km, otra tecla para poner las pulsaciones a 190 bpm (cuando se pulsa de nuevo las pulsaciones vuelven a ser las simuladas), y otra tecla para poner la cadencia a 210 spm (cuando se pulsa de nuevo la cadencia vuelve a ser la simulada)"

## Clarifications

### Session 2026-10-29
- Q: ¿Qué comportamiento debe tener la llamada a la acción ("¡Envíale un ánimo!") cuando el espectador la pulsa en la notificación de sprint? → A: Desplazar suavemente (*smooth scroll*) la pantalla hasta el Muro de Ánimos y preseleccionar el preset de sprint para confirmación manual (Opción B).
- Q: ¿Cómo debe gestionarse en la pantalla de acceso la activación de las notificaciones del navegador si el espectador decide no aceptarlas o ignorarlas? → A: Diálogo de decisión explícita al enviar el formulario: al pulsar "Conectar en Vivo" se solicita el permiso nativo del navegador antes de redirigir al dashboard, continuando con normalidad (solo con snackbars) si el usuario lo deniega (Opción B).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Envío de Ánimos sin Fricción de PIN para Espectadores Autenticados (Priority: P1)

Como espectador que ya ha accedido de forma válida y autenticada al dashboard de seguimiento en vivo, quiero enviar ánimos al corredor desde el muro de ánimos sin tener que volver a ver ni reintroducir el campo de PIN de 4 dígitos, para que mi interacción y apoyo al atleta sea inmediata, fluida y sin fricciones redundantes.

**Why this priority**: Resuelve una fricción directa de usabilidad en el flujo principal de apoyo emocional. Si el espectador ya validó sus credenciales para visualizar la sesión, solicitar el PIN una segunda vez degrada la experiencia de usuario y ralentiza el envío de ánimos.

**Independent Test**: Se puede verificar accediendo a una sesión activa en el dashboard con credenciales válidas y comprobando que el panel del muro de ánimos no renderiza ningún campo de entrada para el PIN, permitiendo enviar mensajes predefinidos o personalizados que son autorizados de forma automática por el sistema.

**Acceptance Scenarios**:

1. **Given** un espectador que ha accedido al dashboard con un PIN verificado o mediante enlace autenticado, **When** visualiza el componente del muro de ánimos, **Then** el formulario muestra únicamente el campo para el nombre del remitente y las opciones de envío de ánimos, omitiendo por completo el campo de entrada de PIN.
2. **Given** un espectador autenticado en el dashboard, **When** pulsa un botón de ánimo predefinido o envía un mensaje personalizado, **Then** el sistema despacha el mensaje adjuntando internamente la credencial de sesión activa sin requerir intervención manual adicional del usuario.
3. **Given** un acceso no autorizado o sesión con PIN inválido, **When** el usuario intenta acceder a la sesión, **Then** se mantiene la pantalla de bloqueo o diálogo de autenticación inicial impidiendo el acceso al dashboard.

---

### User Story 2 - Activación Anticipada de Notificaciones y Alertas de Hitos de Carrera (Priority: P2)

Como espectador en la pantalla de acceso previa al dashboard, quiero que se me solicite explícitamente activar las notificaciones del navegador al conectar en vivo antes de ingresar, para resolver el permiso de antemano sin sufrir interrupciones imprevistas durante la carrera y poder recibir avisos fluidos (snackbar en la webapp y notificación de sistema en el navegador) al completarse el 25%, 50% y 75% del recorrido total.

**Why this priority**: Asegura el consentimiento de notificaciones en el momento oportuno de entrada (onboarding no intrusivo), garantizando que los avisos posteriores por hitos de distancia lleguen al espectador sin bloqueos de permisos a mitad de actividad.

**Independent Test**: Se puede verificar accediendo a la página inicial de acceso e interactuando con "Conectar en Vivo", comprobando que se lanza la petición nativa de permisos del navegador antes de navegar al dashboard. Tras ingresar con permisos concedidos, se simula el avance de la distancia y se confirma la recepción de avisos emergentes (snackbars) y notificaciones de navegador al 25%, 50% y 75% de la distancia total.

**Acceptance Scenarios**:

1. **Given** un espectador en la pantalla de acceso inicial previa a ingresar a la sesión, **When** pulsa el botón "Conectar en Vivo", **Then** el sistema dispara de forma previa y explícita la solicitud nativa de permisos de notificación del navegador web antes de redirigir al dashboard.
2. **Given** que el espectador concede o deniega el permiso de notificación en dicho diálogo previo, **When** se resuelve la interacción, **Then** el sistema procede inmediatamente con la navegación al dashboard sin desplegar solicitudes invasivas adicionales de permisos durante el seguimiento en vivo.
3. **Given** una carrera con distancia total definida y un espectador en el dashboard, **When** la distancia acumulada del corredor cruza el 25% de la distancia total, **Then** se muestra un snackbar emergente en la webapp y se dispara una notificación de navegador indicando que el corredor ha completado el primer cuarto de la carrera.
4. **Given** el corredor sigue avanzando y cruza el 50% de la distancia total, **When** se procesa la telemetría, **Then** se emite la notificación correspondiente al ecuador de la carrera en ambos canales (interfaz y navegador).
5. **Given** el corredor cruza el 75% de la distancia total, **When** se procesa la telemetría, **Then** se emite la notificación del 75% del recorrido indicando la fase decisiva de la prueba.
6. **Given** que el espectador deniega los permisos de notificación del navegador en el diálogo de acceso, **When** se alcanzan los hitos de distancia, **Then** los snackbars internos en la webapp continúan mostrándose con normalidad sin generar errores ni degradar la experiencia visual.

---

### User Story 3 - Avisos de Alto Esfuerzo Cardíaco y Alerta de Sprint con Llamada al Ánimo (Priority: P3)

Como espectador en el dashboard web, quiero ser notificado cuando el corredor supere su umbral de pulsaciones por minuto indicando un alto esfuerzo, así como recibir una alerta urgente destacada cuando además aumente su cadencia de pasos indicando un sprint, invitándome con un botón directo a enviarle fuerzas y ánimos en ese instante crítico mediante un desplazamiento suave al muro de ánimos.

**Why this priority**: Conecta emocionalmente al espectador con los momentos de máxima intensidad biomecánica y fisiológica de la prueba, facilitando el apoyo en el instante en que el atleta más lo necesita.

**Independent Test**: Se puede verificar simulando valores de telemetría con pulsaciones superiores al umbral de esfuerzo y comprobando la emisión del aviso con intervalo mínimo de 30 segundos y un máximo de 3 notificaciones consecutivas. Asimismo, simulando pulsaciones y cadencia elevadas simultáneamente se debe verificar la alerta de sprint (notificación única si restan menos de 2 km; o repetición cada 30 s hasta 3 veces si restan 2 km o más) junto a la llamada a la acción ("¡Envíale un ánimo!"), comprobando que al pulsarla la vista realiza un desplazamiento suave (*smooth scroll*) al Muro de Ánimos y preselecciona el mensaje de sprint para su confirmación.

**Acceptance Scenarios**:

1. **Given** el corredor supera el umbral de pulsaciones por minuto configurado, **When** el sistema detecta la condición, **Then** se muestra una notificación indicando que "{{corredor}} está haciendo un esfuerzo".
2. **Given** que se ha emitido una notificación de esfuerzo y han transcurrido menos de 30 segundos, **When** las pulsaciones continúan altas, **Then** el sistema no reenvía la notificación hasta agotar el periodo de 30 segundos de pausa.
3. **Given** que las pulsaciones se mantienen por encima del límite tras los 30 segundos de espera, **When** se reevalúa la condición, **Then** se vuelve a enviar la notificación de esfuerzo hasta un tope máximo de 3 notificaciones consecutivas. Si la frecuencia cardíaca desciende del límite en cualquier momento, el contador de repeticiones se restablece a cero.
4. **Given** que tanto las pulsaciones como los pasos por minuto (cadencia) superan simultáneamente sus respectivos umbrales y la distancia restante para la meta es menor a 2 km, **When** se detecta la condición de sprint, **Then** se emite una única notificación informando de que el corredor está sprintando e incluyendo una llamada a la acción ("¡Envíale un ánimo!"); **When** el espectador pulsa dicha acción, **Then** la pantalla se desplaza suavemente (*smooth scroll*) hasta el contenedor del Muro de Ánimos y preselecciona el preset de sprint para confirmación y envío manual con un solo clic.
5. **Given** que se detecta condición de sprint pero la distancia restante hasta la meta es de 2 km o más, **When** la condición se mantiene, **Then** se aplican las reglas estándar de reevaluación cada 30 segundos y máximo 3 avisos consecutivos.

---

### User Story 4 - Supresión de Alertas Pasadas para Espectadores que se Unen Tardíamente (Priority: P4)

Como espectador que abre el dashboard cuando la carrera ya ha comenzado y se encuentra avanzada, quiero ver el estado en tiempo real sin ser bombardeado por notificaciones retroactivas de hitos de distancia (25%, 50%, 75%) que ya quedaron en el pasado, recibiendo únicamente alertas si el corredor se encuentra en ese instante en esfuerzo o sprint.

**Why this priority**: Evita una avalancha descontextualizada de alertas acumuladas al cargar la página, asegurando que las notificaciones preserven su sentido de novedad y relevancia en vivo.

**Independent Test**: Se puede verificar conectando un nuevo espectador a una sesión donde el corredor ya ha superado el 60% de la distancia total; se debe validar que no se disparan las notificaciones de los hitos del 25% ni del 50%, pero si el corredor está realizando un esfuerzo o sprint en ese momento, dicha alerta sí se presenta.

**Acceptance Scenarios**:

1. **Given** un corredor que ya ha completado el 60% del recorrido, **When** un espectador se une por primera vez a la sesión web, **Then** el sistema marca internamente los hitos del 25% y 50% como ya acontecidos para este cliente, evitando disparar avisos retroactivos.
2. **Given** un espectador que se une con la carrera avanzada, **When** en el momento de su ingreso el corredor presenta valores activos de alto esfuerzo o sprint, **Then** el espectador sí recibe la notificación de estado actual de esfuerzo/sprint.
3. **Given** el espectador recién incorporado, **When** el corredor posteriormente alcanza el siguiente hito futuro (ej. 75%), **Then** dicho hito sí dispara la notificación en tiempo real con normalidad.

---

### User Story 5 - Controles Interactivos en el Test-Runner para Validación Manual de Alertas (Priority: P5)

Como desarrollador o evaluador del sistema que ejecuta el script de simulación de corredor (`simulate-runner.ts`), quiero disponer de teclas de acceso rápido interactivas en la terminal para avanzar 1 km de distancia de golpe, fijar las pulsaciones a 190 bpm (y volver al modo simulado con otra pulsación) y fijar la cadencia a 210 spm (y volver al modo simulado con otra pulsación), para poder reproducir y verificar de forma inmediata y determinista las alertas de distancia, esfuerzo y sprint sin esperas pasivas.

**Why this priority**: Acelera drásticamente el ciclo de pruebas y validación del sistema de notificaciones, permitiendo disparar las condiciones fisiológicas y de recorrido bajo demanda en segundos.

**Independent Test**: Se puede verificar ejecutando el simulador en la terminal con una sesión web activa y pulsando las teclas asignadas; se comprueba que al pulsar la tecla de distancia la telemetría suma 1.000 m; al pulsar la tecla cardíaca las pulsaciones se fijan en 190 bpm y al repulsar retornan a la curva regular; y al pulsar la tecla de cadencia los pasos/min se fijan en 210 spm y al repulsar retornan a la curva regular.

**Acceptance Scenarios**:

1. **Given** el simulador de corredor en ejecución activa en la terminal, **When** el operador pulsa la tecla designada para avance de distancia (ej. `[k]`), **Then** la distancia total acumulada se incrementa de inmediato en 1.000 metros (1 km) en el siguiente paquete transmitido.
2. **Given** el simulador en ejecución con valores normales de frecuencia cardíaca, **When** el operador pulsa la tecla designada para esfuerzo cardíaco (ej. `[h]`), **Then** la telemetría fija las pulsaciones a 190 bpm de manera continua; **When** se pulsa nuevamente dicha tecla, **Then** las pulsaciones se desenganchan del valor forzado y vuelven a calcularse según la curva matemática de simulación.
3. **Given** el simulador en ejecución con valores normales de cadencia, **When** el operador pulsa la tecla designada para cadencia de sprint (ej. `[c]`), **Then** la telemetría fija la cadencia a 210 spm de manera continua; **When** se pulsa nuevamente dicha tecla, **Then** la cadencia se desengancha del valor forzado y vuelve a calcularse según la curva matemática de simulación.
4. **Given** el simulador con ambas teclas de override activas (190 bpm y 210 spm), **When** se emite la telemetría hacia la webapp, **Then** el cliente web detecta la condición simultánea y dispara la alerta de sprint correspondiente.

---

### Edge Cases

- **Permisos de notificación bloqueados o no disponibles**: Si el navegador del espectador deniega los permisos de notificación web del sistema o el dispositivo no los soporta, el sistema degradará la experiencia sin errores, garantizando que el 100% de los avisos sigan mostrándose como snackbars dentro de la webapp.
- **Acceso directo mediante URL con PIN**: Si el espectador accede directamente a una URL de sesión autenticada saltándose la pantalla de inicio, el sistema comprueba el estado actual del permiso en el navegador; si no está resuelto, continúa con normalidad sin interrumpir con modales bloqueantes.
- **Ausencia de distancia objetivo de carrera**: Si no se ha configurado la distancia en la pasarela móvil ni existe valor de respaldo en el entorno web, los hitos de distancia porcentual se desactivan de forma segura mientras que las alertas fisiológicas de esfuerzo y sprint continúan operando con total normalidad.
- **Fluctuaciones oscilantes en el umbral cardíaco (jitter fisiológico)**: Si las pulsaciones oscilan por encima y por debajo del umbral en periodos breves (ej. 174 -> 176 -> 173 -> 177 bpm), la ventana de enfriamiento de 30 segundos impide el parpadeo o disparo caótico de alertas continuas.
- **Pérdida temporal y reconexión de telemetría**: Si se interrumpe la recepción de datos y se reanuda con un salto de distancia significativo, los hitos intermedios no mostrados durante la desconexión se procesan sin duplicidades y sin bloquear la interfaz.
- **Interacción con el botón de ánimo durante alerta de sprint**: Si el espectador pulsa la llamada a la acción en la notificación de sprint, el sistema realiza un desplazamiento suave (*smooth scroll*) hacia el Muro de Ánimos y preselecciona el mensaje de sprint en el formulario para que el espectador solo tenga que pulsar Enviar sin perder el contexto de la carrera.
- **Pulsación simultánea o no-TTY en el simulador**: Si el script simulador se ejecuta en un entorno sin soporte TTY o en segundo plano, los atajos de teclado se desactivan de forma segura sin interrumpir la emisión periódica a 1 Hz.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE suprimir la visualización del campo de entrada de PIN en el componente de muro de ánimos cuando el espectador ya se encuentre en una sesión de dashboard autenticada.
- **FR-002**: El sistema DEBE asociar automáticamente las credenciales de la sesión activa al despachar cualquier ánimo desde el muro de soporte, sin solicitar reconfirmación de PIN.
- **FR-003**: El sistema DEBE solicitar explícitamente el permiso nativo de notificaciones del navegador al pulsar el botón de acceso ("Conectar en Vivo") en la pantalla inicial, permitiendo la navegación fluida al dashboard tanto si el usuario concede el permiso como si lo deniega.
- **FR-004**: El sistema DEBE abstenerse de desplegar solicitudes emergentes intrusivas de permisos de navegador durante el seguimiento en vivo una vez que el usuario ha ingresado al dashboard.
- **FR-005**: El sistema DEBE permitir definir la distancia total de la carrera en la aplicación móvil de acompañamiento (Android) y transmitirla como metadato de sesión a la plataforma web.
- **FR-006**: El sistema DEBE admitir una variable de configuración de respaldo (fallback) en la aplicación web para establecer la distancia total de la carrera en caso de que no haya sido fijada desde la aplicación móvil.
- **FR-007**: El sistema DEBE emitir una notificación emergente visual (snackbar) dentro de la interfaz web cuando la distancia completada por el corredor alcance o supere los hitos del 25%, 50% y 75% del recorrido total.
- **FR-008**: El sistema DEBE despachar notificaciones del sistema operativo en el navegador para los hitos del 25%, 50% y 75% si los permisos han sido concedidos previamente por el espectador.
- **FR-009**: El sistema DEBE evaluar las pulsaciones por minuto del corredor respecto a un umbral de esfuerzo configurable, emitiendo una notificación con el mensaje "{{corredor}} está haciendo un esfuerzo" al superarlo.
- **FR-010**: El sistema DEBE pausar la comprobación de notificaciones de esfuerzo durante una ventana de enfriamiento de 30 segundos tras cada emisión; si trascurrido dicho tiempo las pulsaciones continúan altas, DEBE reenviar el aviso hasta un máximo de 3 emisiones consecutivas.
- **FR-011**: El sistema DEBE reiniciar la cuenta de notificaciones consecutivas de esfuerzo a cero tan pronto como las pulsaciones del corredor desciendan por debajo del umbral establecido.
- **FR-012**: El sistema DEBE detectar la condición de sprint cuando coincidan simultáneamente pulsaciones por minuto por encima del umbral cardíaco y cadencia de pasos por minuto por encima del umbral de cadencia.
- **FR-013**: El sistema DEBE emitir una notificación de sprint ("¡{{corredor}} está sprintando!") que incorpore una llamada directa a la acción ("¡Envíale un ánimo!") que, al ser pulsada por el espectador, desplace suavemente (*smooth scroll*) la pantalla hasta el Muro de Ánimos y preseleccione el mensaje de sprint para su confirmación y despacho.
- **FR-014**: El sistema DEBE limitar la notificación de sprint a una única emisión si la distancia restante hasta el final de la carrera es inferior a 2 kilómetros.
- **FR-015**: Si la distancia restante es igual o superior a 2 kilómetros, el sistema DEBE aplicar a la alerta de sprint la regla estándar de verificación cada 30 segundos y límite de 3 avisos consecutivos.
- **FR-016**: El sistema DEBE ignorar y no emitir notificaciones retroactivas de los hitos del 25%, 50% y 75% para aquellos espectadores que se incorporen a la sesión web con posterioridad a que el corredor haya superado dichos puntos kilométricos.
- **FR-017**: El sistema DEBE evaluar el estado fisiológico de esfuerzo y sprint en tiempo real en el momento en que un espectador tardío se incorpore a la sesión, notificándolo de inmediato si dicha condición se encuentra activa en ese instante.
- **FR-018**: El simulador de corredor (`simulate-runner.ts`) DEBE admitir entrada interactiva por teclado para añadir 1 kilómetro (1.000 metros) instantáneo a la distancia acumulada mediante una tecla dedicada (ej. `[k]`).
- **FR-019**: El simulador de corredor DEBE admitir entrada interactiva por teclado para conmutar el valor de pulsaciones a 190 bpm (y alternar de nuevo al valor dinámico calculado) mediante una tecla dedicada (ej. `[h]`).
- **FR-020**: El simulador de corredor DEBE admitir entrada interactiva por teclado para conmutar el valor de cadencia a 210 spm (y alternar de nuevo al valor dinámico calculado) mediante una tecla dedicada (ej. `[c]`).

### Key Entities *(include if feature involves data)*

- **Configuración de Recorrido de Carrera**: Representa la distancia meta total de la actividad (en metros o kilómetros), establecida en el inicio de sesión desde la pasarela móvil o deducida a partir de la configuración por defecto del entorno web.
- **Evento de Notificación al Espectador**: Representa un aviso emitido hacia el usuario espectador, conteniendo el tipo de evento (hito porcentual, esfuerzo cardíaco, sprint con invitación a ánimo), marca de tiempo, texto descriptivo, identificador de atleta y elementos de llamada a la acción opcionales.
- **Controlador de Estado de Alertas**: Estructura de estado local por cliente espectador que registra los hitos ya notificados, la marca de tiempo de la última notificación emitida por categoría, el contador de repeticiones consecutivas acumuladas y el instante de incorporación del espectador a la sesión.
- **Estado de Anulación Manual de Simulación (Test-Runner)**: Bandera de control en el simulador que almacena los estados activos de sobreescritura (override) para frecuencia cardíaca fija (190 bpm) y cadencia fija (210 spm), así como el desplazamiento acumulativo manual de distancia (+N km).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los espectadores autenticados completan el envío de ánimos desde el muro en un único paso sin visualizar ni introducir campos de PIN, eliminando el 100% de las solicitudes de credenciales duplicadas.
- **SC-002**: El 100% de los espectadores que acceden a través de la pantalla de inicio resuelven la solicitud nativa de permisos de navegador al pulsar "Conectar en Vivo", con 0 solicitudes invasivas adicionales dentro del dashboard en vivo.
- **SC-003**: Las notificaciones de los hitos de distancia (25%, 50% y 75%) se despliegan en la interfaz del espectador en menos de 1 segundo tras la recepción de la telemetría que cruza el umbral.
- **SC-004**: Cero duplicidades de alertas de esfuerzo o sprint emitidas en un intervalo inferior a 30 segundos para una misma sesión de espectador.
- **SC-005**: El 100% de los espectadores que se unen a una sesión iniciada con hitos previos cumplidos reciben cero notificaciones retroactivas de los hitos superados con anterioridad a su conexión.
- **SC-006**: La pulsación de la llamada a la acción en una notificación de sprint realiza un desplazamiento suave directo al Muro de Ánimos con el mensaje preseleccionado en menos de 500 milisegundos.
- **SC-007**: El simulador de corredor responde a las pulsaciones de teclado de prueba (+1 km, 190 bpm, 210 spm) reflejando el nuevo valor en el siguiente paquete de telemetría a 1 Hz en menos de 100 milisegundos tras la pulsación.

## Assumptions

- El nombre del corredor (`{{corredor}}`) se toma de la metadata de la sesión activa transmitida por la pasarela móvil, con valor de respaldo por defecto configurado en la web (ej. "Víctor").
- La distancia de carrera se introduce en la interfaz de la aplicación Android al configurar la sesión (similar al ritmo objetivo) y se envía en el registro de sesión; si no se especifica, la web utiliza un valor de respaldo configurable (ej. 10.000 metros / 10 km).
- Los umbrales predeterminados de esfuerzo fisiológico se basan en las zonas de frecuencia cardíaca existentes (ej. Zona 5 / >175 BPM para esfuerzo) y cadencia (ej. >180 pasos por minuto para sprint), configurables mediante variables de entorno en el cliente web.
- Las notificaciones en el navegador utilizan los estándares de la API de Notificaciones web (Web Notifications API); si el usuario rechaza los permisos o la plataforma no los admite, la experiencia continúa operando de forma íntegra mediante las notificaciones emergentes (snackbars) internas de la webapp.
- La evaluación de hitos de distancia es estrictamente progresiva y monótona, evitando que correcciones o fluctuaciones mínimas de GPS provoquen emisiones múltiples de un mismo hito de distancia ya alcanzado.
- Las teclas interactivas de simulación en el test-runner (`[k]` para distancia, `[h]` para ritmo cardíaco, `[c]` para cadencia) se integran de manera complementaria a los controles existentes (`[r]` para agradecimiento y `[f]` para finalización).
