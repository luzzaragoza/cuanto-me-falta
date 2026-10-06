// El panel de resultados — TODAVÍA SIN DATOS.
//
// El diseño (Luz, 28-sep) muestra cuántos alumnos usan la app, cuándo vuelven, qué
// materias los traban y qué miran en el árbol. Nada de eso se puede calcular hoy: la base
// guarda una sola "última visita" por alumno, sin historial, y las vistas del árbol van a
// la analítica anónima, no a la base. Hasta que empiece a juntarse, esta pantalla dice
// eso mismo en vez de mostrar números inventados.

export function Resultados() {
  return (
    <main className="in-main">
      <div className="lp-vacio rs-vacio">
        <span className="lp-vacio-deco" />
        <span className="lp-vacio-mark">¿</span>
        <h2>Todavía estamos juntando los datos</h2>
        <p>
          Este panel va a mostrar cuántos alumnos usan la app, cuándo vuelven, qué materias los
          traban y qué miran en el árbol. Aparece acá cuando haya datos suficientes para
          mostrarlos sin identificar a nadie: nunca un corte de menos de 5 alumnos.
        </p>
        <a className="lp-secundario" href="#admin">
          ← Volver al inicio
        </a>
      </div>
    </main>
  )
}
