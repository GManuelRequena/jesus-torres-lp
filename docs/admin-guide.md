# Guía de administración — Panel de Jesús Torres EP

## Acceso

1. Ir a `https://entrenadorjesustorres.netlify.app/portal/`
2. Iniciar sesión con tu cuenta de administrador (email + contraseña)
3. El sistema te redirige automáticamente al panel de admin

> Los alumnos van a su propio dashboard con la rutina. Solo las cuentas con rol `admin` llegan a este panel.

---

## Ver y editar un alumno

La pestaña **ALUMNOS** muestra la lista de alumnos activos. El número entre paréntesis indica cuántos hay.

**Para editar:**
1. Tocá el nombre del alumno para expandir su card
2. Editá los campos que necesites
3. Presioná **Guardar**

### Campos disponibles

| Campo | Para qué sirve |
|---|---|
| **Google Doc** | ID o URL del documento con la rutina. Al pegar una URL completa se extrae el ID automáticamente. |
| **Servicio** | Modalidad del entrenamiento (ej: *Online 3x/semana*, *Presencial*) |
| **Objetivo** | Meta del alumno (ej: *Bajar de peso*, *Ganar masa muscular*) |
| **Patologías / condiciones** | Lesiones, enfermedades o limitaciones a tener en cuenta al diseñar la rutina |
| **Notas internas** | Cualquier anotación que no encaje en los otros campos |

> **Google Doc:** el alumno ve su rutina en tiempo real. Cada vez que editás el doc y el alumno recarga la página, ve los cambios. No hace falta tocar nada en el panel.

---

## Historial de peso

Dentro de la card de cada alumno hay una sección **Historial de peso**.

**Para registrar un pesaje:**
1. Completá el campo de kg (ej: `78.5`)
2. Verificá o cambiá la fecha (por defecto es hoy)
3. Presioná **+ Registrar**

Los registros se muestran del más reciente al más antiguo.

**Para eliminar un registro:**  
Presioná el botón **×** a la derecha de la entrada. Se elimina inmediatamente.

> El historial se conserva aunque el alumno sea archivado. Si vuelve, los datos están intactos.

---

## Invitar un alumno nuevo

1. Ir a la pestaña **INVITAR**
2. Completar **Nombre completo** y **Email**
3. Presionar **Enviar invitación**

El alumno recibe un email con un link para establecer su contraseña. Una vez que lo hace, puede entrar al portal.

**Después de invitar:**
- El alumno aparece en la lista de activos
- Abrí su card y pegá el ID o URL del Google Doc con su rutina
- Guardá

> Si el email ya estaba registrado, recibirás un mensaje de error. Verificá en la lista de alumnos si ya existe.

---

## Archivar y reactivar alumnos

**Archivar** se usa cuando un alumno deja de entrenar con vos.

1. Abrí la card del alumno
2. Presioná **Archivar**
3. Confirmá en el diálogo que aparece

El alumno pierde acceso al portal inmediatamente pero sus datos (historial de peso, doc, notas) se conservan.

**Para ver los alumnos archivados:** al final de la lista de activos aparece el botón **Ver archivados (N)**. Expandilo para ver la lista.

**Para reactivar:** abrí la card del alumno archivado y presioná **Reactivar**. Recupera el acceso al portal de inmediato.

---

## Formato del Google Doc

El parser lee el documento y arma la rutina automáticamente. El doc tiene que seguir esta estructura:

```
== MOVILIDAD ARTICULAR ==
DÍA 1
- Nombre del ejercicio: https://youtube.com/...
- Otro ejercicio

DÍA 2
- Ejercicio A
- Ejercicio B

== ENTRADA EN CALOR ==
DÍA 1
- Ejercicio
- Ejercicio

== PARTE PRINCIPAL ==
DÍA 1
1. Nombre | 4×10 | 20kg
2. Nombre | 3×12
3. Nombre | 3×30" | https://youtube.com/...

DÍA 2
1. Nombre | 3×8 | 15kg
2. Nombre | 4×15

== PERIODIZACIÓN ==
Sem 1: Adaptación — cargas bajas
Sem 2: Desarrollo — cargas moderadas
Sem 3: Intensificación — cargas altas
Sem 4: Descarga
```

### Reglas de la Parte Principal

Cada ejercicio va en el formato: `Nombre | series×reps | peso (opcional) | URL (opcional)`

- Series y reps: `4×10`, `3×12`
- Segundos: `3×30"` (las comillas indican segundos)
- Peso: `20kg` o `3 lingotes`
- URL de video: pegar la URL de YouTube al final

El orden de los campos no importa, el sistema los detecta automáticamente.

### Días soportados

El parser soporta hasta **3 días** (`DÍA 1`, `DÍA 2`, `DÍA 3`). Si el alumno entrena más días, hay que adaptar la rutina o usar el campo Notas para los días extra.

### El alumno no ve cambios

Si editaste el doc y el alumno dice que no ve nada nuevo: pedile que **recargue la página** con Ctrl+R (o tire para abajo en mobile). La rutina no se cachea.
