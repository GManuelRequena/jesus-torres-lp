# Jesús Torres — Entrenador Personal

Landing page y portal de alumnos para Jesús Torres, Profesor de Educación Física.

**Producción:** [entrenadorjesustorres.netlify.app](https://entrenadorjesustorres.netlify.app)

---

## Stack

- HTML + CSS + JS vanilla — sin frameworks
- [Netlify](https://netlify.com) — hosting, functions y autenticación
- [Brevo](https://brevo.com) — captura de leads
- [Netlify Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/) — autenticación del portal de alumnos

## Estructura

```
├── index.html                  # Landing page principal
├── styles.css                  # Estilos de la landing
├── og-image.svg                # Imagen Open Graph
├── routines.json               # Mapeo email → URL de Google Doc por alumno
├── netlify.toml                # Configuración de Netlify (functions + redirects)
├── netlify/
│   └── functions/
│       └── subscribe.js        # Captura de leads en Brevo
└── portal/
    ├── index.html              # Login del portal de alumnos
    ├── dashboard.html          # Dashboard con rutina embebida
    └── portal.css              # Estilos del portal
```

## Portal de alumnos

El portal permite a los alumnos acceder a su rutina personalizada en `/portal/`.

**Autenticación:** Netlify Identity (invite-only). Los alumnos reciben un email de invitación y eligen su contraseña.

**Roles:**
- `alumno` — acceso al dashboard con su rutina
- `admin` — acceso reservado para Jesús Torres

**Rutinas:** cada alumno tiene asignado un Google Doc en `routines.json`:

```json
{
  "alumno@email.com": "https://docs.google.com/document/d/XXXXX/edit"
}
```

El doc debe estar compartido como "Cualquier persona con el enlace puede ver".

### Agregar un alumno nuevo

1. Netlify → Identity → **Invite user** con el email del alumno
2. Asignar rol `alumno` en Identity → usuario → Edit settings
3. Agregar entrada en `routines.json` con su email y la URL del Google Doc
4. Commitear y pushear a `develop`

## Variables de entorno

Configuradas en Netlify (Settings → Environment variables):

| Variable | Descripción |
|---|---|
| `BREVO_API_KEY` | API key de Brevo para captura de leads |

## Desarrollo local

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Correr localmente con functions
netlify dev
```

## Ramas

| Rama | Descripción |
|---|---|
| `main` | Producción — se deploya automáticamente en Netlify |
| `develop` | Integración — requiere PR para mergear |
| `feature/*` | Features en desarrollo |

## Release

El proceso de release es manual:

1. **GitHub → Actions → Release PR → Run workflow**
   Genera el PR `develop → main` con el changelog agrupado por tipo de commit.

2. Revisás el PR y lo aprobás.

3. Al mergear, se crea automáticamente un tag `vYYYY.MM.DD` en `main`.
