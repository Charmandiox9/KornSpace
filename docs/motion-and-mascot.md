# Movimiento y mascota de KornSpace

La identidad hace referencia a un espacio de trabajo y almacenamiento. El gallo es un guardián de archivos: sostiene una carpeta, tiene documentos organizados junto a él y pequeños copos de cereal sobre una base de escritorio. No se usan escenarios astronómicos ni recursos externos.

## Login

`LoginMascotScene` carga dinámicamente Three.js 0.187 y un modelo procedural original. El renderer usa WebGL 2, geometrías y materiales compartidos, resolución limitada a 1.5 píxeles por píxel CSS y renderizado a unos 30 fotogramas por segundo. La escena se detiene al quedar fuera de la vista, ocultarse la pestaña, activar movimiento reducido o pulsar Pausar. Existe una marca estática de respaldo si WebGL no está disponible o se pierde el contexto.

Los recursos GPU, observers y listeners se liberan al desmontar. Three.js no forma parte de la ruta de carga de las vistas de archivos; su módulo se importa al montar la escena de login.

## Vistas de trabajo

El movimiento comunica respuestas y relaciones: navegación y títulos, aparición de elementos nuevos, reordenación espacial de tarjetas, apertura de menús y diálogos y pulsaciones de controles. Los archivos existentes no vuelven a ejecutar la animación de entrada en cada actualización. Las acciones de teclado conservan respuesta inmediata.

Se usan WAAPI y transiciones de transform/opacity, con la curva `--ease-out` y duraciones de 160–240 ms. No se modifican las animaciones internas de Sileo ni se añaden fondos en movimiento a la biblioteca.

El control de pausa de la apariencia conserva la preferencia local. `prefers-reduced-motion` siempre prevalece. Los controles permanecen accesibles y la interfaz conserva sus estados y funciones sin animación. La mascota queda estática con esta preferencia.

## Dependencias y verificación

Se añadió únicamente Three.js y sus tipos para la escena solicitada, mediante pnpm. El parche versionado de Sileo se conserva en el lockfile. Las pruebas de navegador usan un renderer software para comprobar el canvas, pausa/reanudación, movimiento reducido, cambio de tema, móvil y respaldo ante pérdida de contexto.
