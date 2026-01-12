import { Layout } from "@/components/layout/Layout";

const Terms = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-background py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Términos y Condiciones – Washero
          </h1>
          
          <p className="text-muted-foreground mb-8">
            Última actualización: Enero 2026
          </p>

          <div className="prose prose-lg max-w-none space-y-8 text-foreground">
            
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Descripción del servicio</h2>
              <p className="text-muted-foreground">
                Washero es un servicio de lavado de autos premium a domicilio que opera en Buenos Aires y alrededores. Nuestros profesionales se desplazan hasta tu ubicación para realizar el lavado de tu vehículo con productos ecológicos y técnicas de alta calidad.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Precios</h2>
              <p className="text-muted-foreground">
                Los precios de nuestros servicios están publicados en nuestra plataforma y pueden variar según el tipo de lavado, tamaño del vehículo y extras seleccionados. Washero se reserva el derecho de modificar los precios en cualquier momento. Los cambios de precio no afectarán las reservas ya confirmadas.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Suscripciones</h2>
              <p className="text-muted-foreground mb-4">
                Washero ofrece planes de suscripción mensual que incluyen:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Plan Básico:</strong> 2 lavados mensuales</li>
                <li><strong>Plan Confort:</strong> 4 lavados mensuales</li>
                <li><strong>Plan Premium:</strong> 8 lavados mensuales</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Reglas de suscripción:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Los créditos de lavado se consumen por cada lavado completado</li>
                <li>Los créditos no utilizados no se acumulan para el mes siguiente</li>
                <li>La primera suscripción requiere aprobación del administrador</li>
                <li>La suscripción se renueva automáticamente cada mes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Cancelación y reprogramación</h2>
              <p className="text-muted-foreground mb-4">
                <strong>Reservas individuales:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Podés cancelar o reprogramar tu reserva hasta 24 horas antes del horario programado sin costo</li>
                <li>Las cancelaciones con menos de 24 horas de anticipación pueden estar sujetas a un cargo</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                <strong>Suscripciones:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Podés cancelar tu suscripción en cualquier momento desde tu panel de usuario</li>
                <li>La cancelación será efectiva al finalizar el período de facturación actual</li>
                <li>No se realizan reembolsos por períodos parciales</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Métodos de pago</h2>
              <p className="text-muted-foreground mb-4">
                Aceptamos los siguientes métodos de pago:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Efectivo:</strong> Pago al momento del servicio</li>
                <li><strong>MercadoPago:</strong> Pago online seguro con tarjeta de crédito, débito o dinero en cuenta</li>
                <li><strong>Suscripción:</strong> Débito automático mensual</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Responsabilidad</h2>
              <p className="text-muted-foreground">
                Washero se compromete a realizar el servicio con el mayor profesionalismo y cuidado. Sin embargo, no nos hacemos responsables por daños preexistentes en el vehículo o por objetos de valor dejados en el interior. Te recomendamos retirar objetos personales antes del servicio.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Modificaciones</h2>
              <p className="text-muted-foreground">
                Washero se reserva el derecho de modificar estos términos y condiciones en cualquier momento. Los cambios serán publicados en esta página y entrarán en vigencia inmediatamente. El uso continuado del servicio implica la aceptación de los términos actualizados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Contacto</h2>
              <p className="text-muted-foreground">
                Para consultas sobre estos términos y condiciones, contactanos en:
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

export default Terms;
