# Movimiento y mascota de KornSpace

La identidad hace referencia a un espacio de trabajo y almacenamiento. El gallo es un guardián de archivos: sostiene una carpeta, tiene documentos organizados junto a él y pequeños copos de cereal sobre una base de escritorio. No se usan escenarios astronómicos ni recursos externos.

## Login

`LoginMascotScene` carga dinámicamente Three.js 0.187 y un modelo procedural original. El gallo se forma con 14000 tetraedros mediante un único `InstancedMesh`, muestreando las superficies geométricas con una semilla reproducible. El muestreo reserva densidad adicional para ojos, dedos y etiquetas pequeñas; las piezas más finas son menores para conservar los detalles. La figura incluye contornos de ojos, pupilas con brillo, cejas, seis plumas con nervaduras, dedos y etiquetas de documentos. La bóveda se construye con geometrías reutilizables: marco, puerta articulada, bisagras, rueda con tres radios, pernos, repisa y documentos; el indicador cambia al cerrarse. La bóveda ilustra almacenamiento privado y no representa una garantía adicional de cifrado.

La secuencia se reproduce sin interacción en ciclos de 18 segundos: formación, saludo con la carpeta, apertura de la puerta, entrada del gallo, cierre seguro, regreso y dispersión. La puerta se abre por completo antes de que el gallo atraviese la entrada. La pose dispersa final coincide con el inicio del siguiente ciclo. Pausar conserva la posición de la secuencia y Play la continúa.

Por solicitud explícita del producto, el login inicia la reproducción automáticamente en cada visita o recarga, incluso si el sistema o la preferencia del workspace solicitan movimiento reducido. La pausa es local a la escena y no altera las preferencias del workspace; al volver a abrir el login empieza una secuencia nueva. El encabezado de login ofrece idioma y tema; la pausa de esta animación está junto a la figura. En escritorio, la escena amplia ocupa el panel izquierdo y el acceso con Google el derecho, con un ancho total de hasta 1600 px; en móvil el acceso aparece primero.

El renderer usa WebGL 2, resolución limitada a 1.5 píxeles por píxel CSS y renderizado a unos 30 fotogramas por segundo. La escena se detiene al quedar fuera de la vista, ocultarse la pestaña o pulsar Pausar. Existe una marca estática de respaldo si WebGL no está disponible o se pierde el contexto.

Los recursos GPU, observers y listeners se liberan al desmontar. Three.js no forma parte de la ruta de carga de las vistas de archivos; su módulo se importa al montar la escena de login.

## Vistas de trabajo

El movimiento comunica respuestas y relaciones: navegación y títulos, aparición de elementos nuevos, reordenación espacial de tarjetas, apertura de menús y diálogos y pulsaciones de controles. Los archivos existentes no vuelven a ejecutar la animación de entrada en cada actualización. Las acciones de teclado conservan respuesta inmediata.

Se usan WAAPI y transiciones de transform/opacity, con la curva `--ease-out` y duraciones de 160–240 ms. No se modifican las animaciones internas de Sileo ni se añaden fondos en movimiento a la biblioteca.

En las vistas de trabajo, el control de apariencia conserva la preferencia local: por defecto sigue `prefers-reduced-motion`, y una selección explícita de Activar animaciones o Reducir animaciones prevalece sobre el sistema. Los controles permanecen accesibles y la interfaz conserva sus estados y funciones sin animación. La reproducción independiente del login no cambia esta configuración.

## Dependencias y verificación

Se añadió únicamente Three.js y sus tipos para la escena solicitada, mediante pnpm. El parche versionado de Sileo se conserva en el lockfile. Las pruebas unitarias verifican varios ciclos, la continuidad de sus límites y la coordinación de la puerta con el desplazamiento. Las pruebas de navegador usan un renderer software para comprobar reproducción automática al entrar y recargar con movimiento reducido, el reinicio de la secuencia de bóveda, pausa/reanudación mediante comparación de capturas del canvas, cambio de tema, móvil y respaldo ante pérdida de contexto.
