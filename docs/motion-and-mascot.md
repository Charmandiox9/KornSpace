# Movimiento y mascota de KornSpace

La identidad hace referencia a un espacio de trabajo y almacenamiento. El gallo es un guardián de archivos: sostiene una carpeta, tiene documentos organizados junto a él y pequeños copos de cereal sobre una base de escritorio. No se usan escenarios astronómicos ni recursos externos.

## Login

`LoginMascotScene` carga dinámicamente Three.js 0.187 y un modelo procedural original. El gallo se forma con 14000 tetraedros mediante un único `InstancedMesh`, muestreando las superficies geométricas con una semilla reproducible. El muestreo reserva densidad adicional para ojos, dedos y etiquetas pequeñas; las piezas más finas son menores para conservar los detalles. La figura incluye contornos de ojos, pupilas con brillo, cejas, dedos y una cola corta con tres plumas de tonos marfil y violeta. La bóveda se construye con geometrías reutilizables: marco, puerta articulada, bisagras, rueda con tres radios y pernos; el indicador cambia al cerrarse. La bóveda ilustra almacenamiento privado y no representa una garantía adicional de cifrado.

La cámara interior tiene 2.7 unidades de profundidad. Sus paredes, suelo y marcos sucesivos muestran la perspectiva. Los estantes ocupan únicamente el lateral derecho y contienen cuatro tarjetas con iconos geométricos de imagen (montañas y sol), vídeo (película y Play), texto (líneas) y carpeta. El gallo se alinea frente a la entrada y después avanza por el pasillo izquierdo. Las coordenadas del modelo y el recorrido se comparten mediante `mascot-spatial.ts`; las pruebas verifican un volumen horizontal conservador, incluido al girar, para evitar cruces con estantes, puerta y pared del fondo.

La secuencia se reproduce sin interacción en ciclos de 22 segundos: formación, saludo con la carpeta, apertura de la puerta, entrada del gallo, entrega de la carpeta, cierre seguro, regreso con las manos vacías y dispersión. La carpeta entregada aparece en el estante superior y sólo vuelve a las manos del gallo al comenzar un ciclo nuevo. La puerta se abre por completo antes de que el gallo atraviese la entrada. La pose dispersa final coincide con el inicio del siguiente ciclo.

La marcha utiliza articulaciones de cadera, rodilla y tobillo con cinemática inversa de dos segmentos. La distancia recorrida determina los pasos; cada pie alterna apoyo y elevación, y la compensación del cuerpo mantiene el apoyo al oscilar. Los hombros, codos, muñecas y cuello tienen pivotes propios: las alas sujetan la carpeta durante la entrada y se recogen y balancean durante la salida. El cambio entre marcha y reposo se suaviza, y la cabeza compensa la inclinación del torso. El recorrido de entrada y salida se alarga para dar tiempo a los apoyos y giros.

Por solicitud explícita del producto, el login inicia la reproducción automáticamente en cada visita o recarga, incluso si el sistema o la preferencia del workspace solicitan movimiento reducido. No hay botones de reproducción o pausa. La escena no altera las preferencias del workspace; al volver a abrir el login empieza una secuencia nueva. El encabezado de login ofrece idioma y tema. En escritorio, la escena amplia ocupa el panel izquierdo y el acceso con Google el derecho, con un ancho total de hasta 1600 px; en móvil el acceso aparece primero.

El renderer usa WebGL 2, resolución limitada a 1.5 píxeles por píxel CSS y renderizado a unos 30 fotogramas por segundo. La escena se detiene al quedar fuera de la vista u ocultarse la pestaña y se reanuda al volver. Existe una marca estática de respaldo si WebGL no está disponible o se pierde el contexto.

Los recursos GPU, observers y listeners se liberan al desmontar. Three.js no forma parte de la ruta de carga de las vistas de archivos; su módulo se importa al montar la escena de login.

## Vistas de trabajo

El movimiento comunica respuestas y relaciones: navegación y títulos, aparición de elementos nuevos, reordenación espacial de tarjetas, apertura de menús y diálogos y pulsaciones de controles. Los archivos existentes no vuelven a ejecutar la animación de entrada en cada actualización. Las acciones de teclado conservan respuesta inmediata.

Se usan WAAPI y transiciones de transform/opacity, con la curva `--ease-out` y duraciones de 160–240 ms. No se modifican las animaciones internas de Sileo ni se añaden fondos en movimiento a la biblioteca.

En las vistas de trabajo, el control de apariencia conserva la preferencia local: por defecto sigue `prefers-reduced-motion`, y una selección explícita de Activar animaciones o Reducir animaciones prevalece sobre el sistema. Los controles permanecen accesibles y la interfaz conserva sus estados y funciones sin animación. La reproducción independiente del login no cambia esta configuración.

## Dependencias y verificación

Se añadió únicamente Three.js y sus tipos para la escena solicitada, mediante pnpm. El parche versionado de Sileo se conserva en el lockfile. Las pruebas unitarias verifican varios ciclos, la continuidad de sus límites, la coordinación de la puerta, la entrega antes de salir, los objetivos de los pies y el espacio libre en todo el recorrido de ida y vuelta. Las pruebas de navegador usan un renderer software para comprobar reproducción automática al entrar y recargar con movimiento reducido, ausencia de botones de reproducción, cambios reales en el canvas, la salida sin carpeta, el reinicio de la secuencia de bóveda, cambio de tema, móvil y respaldo ante pérdida de contexto.
