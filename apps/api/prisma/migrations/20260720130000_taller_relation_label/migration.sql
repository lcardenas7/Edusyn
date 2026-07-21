-- El Mapa de Actores necesita CONEXIONES LIBRES con significado propio: "el rector
-- influye en la coordinadora", "los estudiantes usan los baños". La etiqueta es
-- texto libre del equipo; relType conserva su vocabulario tipado.
-- Aditiva y sin pérdida: las aristas existentes (deriva-de, vota, responde-a) no
-- usan label y siguen igual.

ALTER TABLE "TallerRelation" ADD COLUMN IF NOT EXISTS "label" TEXT;
