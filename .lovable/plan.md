## Objetivo
Exponer temporalmente el `SUPABASE_SERVICE_ROLE_KEY` para que lo puedas copiar y pegar en Render, sin comprometer seguridad.

## Pasos

1. **Crear edge function `admin-reveal-service-key`**
   - Valida que el request tenga JWT de un usuario autenticado.
   - Verifica que ese usuario tenga rol `admin` en `user_roles`.
   - Si pasa, devuelve un JSON con:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `WHATSAPP_TRANSCODER_SECRET` (para que también lo copies a Render como `TRANSCODER_SHARED_SECRET`)
   - Si no es admin → 403.
   - Logs mínimos (no loguea el valor de la key).

2. **Agregar botón temporal "Revelar keys de Render" en `MessagesTab.tsx`** (o donde tengas el panel admin de WhatsApp).
   - Solo visible para admin.
   - Al click, invoca la function, muestra los valores en un dialog con botones "Copiar".
   - Incluye instrucción visual: "Pegar en Render → Save → esperar redeploy".

3. **Vos copiás los valores a Render** con estos nombres exactos:
   ```
   SUPABASE_URL              = https://pkndizbozytnpgqxymms.supabase.co
   SUPABASE_SERVICE_ROLE_KEY = <valor revelado>
   SUPABASE_BUCKET           = whatsapp-media
   TRANSCODER_SHARED_SECRET  = <valor revelado>
   ```

4. **Confirmás conmigo cuando Render redeployó**, y corro `admin-repair-whatsapp-audio` sobre los audios pendientes para validar end-to-end.

5. **Cleanup obligatorio**: una vez funcionando, **elimino la edge function `admin-reveal-service-key` y el botón**. Esto no se queda en producción.

## Seguridad
- La function requiere JWT válido + rol admin (mismo patrón que `_shared/adminAuth.ts`).
- Los valores nunca se loguean.
- La función se borra después del setup.
- Si querés extra paranoia, después rotamos el service_role key con `supabase--rotate_api_keys` (te aviso).

## Archivos afectados
- `supabase/functions/admin-reveal-service-key/index.ts` (nuevo, temporal)
- `src/components/admin/MessagesTab.tsx` (botón temporal)

¿Le doy?