import { Layout } from "@/components/layout/Layout";

const Privacy = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-background py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Política de Privacidad – Washero
          </h1>
          
          <p className="text-muted-foreground mb-8">
            Última actualización: Enero 2026
          </p>

          <div className="prose prose-lg max-w-none space-y-8 text-foreground">
            
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Datos que recopilamos</h2>
              <p className="text-muted-foreground mb-4">
                Para brindarte nuestros servicios de lavado de autos a domicilio, recopilamos la siguiente información:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Nombre completo</li>
                <li>Número de teléfono</li>
                <li>Dirección de correo electrónico</li>
                <li>Dirección de servicio</li>
                <li>Información de reservas y suscripciones</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Uso de los datos</h2>
              <p className="text-muted-foreground mb-4">
                Utilizamos tus datos personales para:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Gestión de reservas de lavados</li>
                <li>Gestión de suscripciones mensuales</li>
                <li>Facturación y procesamiento de pagos</li>
                <li>Notificaciones por WhatsApp y email sobre el estado de tus servicios</li>
                <li>Comunicaciones relacionadas con tu cuenta</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Compartir datos</h2>
              <p className="text-muted-foreground">
                <strong>No vendemos tus datos personales.</strong> Solo compartimos información con proveedores de servicios esenciales para operar Washero, como procesadores de pagos (MercadoPago) y servicios de mensajería (WhatsApp). Estos proveedores están obligados a proteger tu información y usarla únicamente para los fines acordados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Almacenamiento y seguridad</h2>
              <p className="text-muted-foreground">
                Tus datos se almacenan de forma segura utilizando estándares de seguridad de la industria. Implementamos medidas técnicas y organizativas para proteger tu información contra acceso no autorizado, pérdida o alteración.
              </p>
            </section>

            <section id="eliminacion">
              <h2 className="text-2xl font-semibold mb-4">5. Eliminación de datos de usuario</h2>
              <p className="text-muted-foreground">
                El usuario puede solicitar la eliminación total de sus datos personales escribiendo a{" "}
                <a href="mailto:hola@washero.online" className="text-primary hover:underline">
                  hola@washero.online
                </a>
                . La solicitud será procesada en un plazo máximo de 72 horas.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Contacto</h2>
              <p className="text-muted-foreground">
                Si tenés preguntas sobre esta política de privacidad o sobre cómo manejamos tus datos, podés contactarnos en:
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Email:</strong>{" "}
                <a href="mailto:hola@washero.online" className="text-primary hover:underline">
                  hola@washero.online
                </a>
              </p>
            </section>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Privacy;
