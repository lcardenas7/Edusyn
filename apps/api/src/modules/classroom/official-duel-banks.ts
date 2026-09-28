export type OfficialBank = {
  catalogId: string; title: string; grade: number; subjectArea: string; category: string; version: string;
  questions: Array<{ id: string; number: number; topic: string; concept: string; difficulty: string; type: "MULTIPLE_CHOICE" | "TRUE_FALSE"; text: string; options: string[]; correctAnswer: string; explanation: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

export const OFFICIAL_DUEL_BANKS: OfficialBank[] = [
  {
    "catalogId": "edusyn-arte-cultura-grade-6-v1",
    "title": "Arte y cultura · 6.º",
    "grade": 6,
    "subjectArea": "Duelos",
    "category": "Arte y cultura",
    "version": "1.0",
    "availability": "institution-opt-in",
    "editorialStatus": "ready-for-import",
    "audit": {
      "questions": 150,
      "multipleChoice": 120,
      "trueFalse": 30,
      "difficulty": {
        "basic": 50,
        "intermediate": 70,
        "application": 30
      },
      "answerPositions": {
        "B": 30,
        "C": 30,
        "D": 30,
        "A": 30
      },
      "sourceAnswerMarker": "PDF trailing-space check mark verified on sample pages; option ordering balanced without changing answers",
      "conceptsPresent": 150,
      "conceptsMissing": 0
    },
    "questions": [
      {
        "id": "ART6-001",
        "number": 1,
        "topic": "Artes visuales",
        "concept": "artes_visuales_elemento_permite_distinguir_figura_fondo_contorno",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál elemento permite distinguir principalmente una figura de su fondo por su contorno?",
        "options": [
          "Ritmo",
          "Línea",
          "Volumen",
          "Textura"
        ],
        "correctAnswer": "Línea",
        "explanation": "La línea puede delimitar el contorno de una figura.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-002",
        "number": 2,
        "topic": "Color",
        "concept": "color_color_obtiene_normalmente_mezclar_pintura_azul",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué color se obtiene normalmente al mezclar pintura azul y amarilla?",
        "options": [
          "Violeta",
          "Naranja",
          "Verde",
          "Marrón"
        ],
        "correctAnswer": "Verde",
        "explanation": "En la mezcla tradicional de pigmentos, azul y amarillo producen verde.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-003",
        "number": 3,
        "topic": "Música",
        "concept": "musica_pertenece_a_familia_instrumentos_percusion",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál pertenece a la familia de instrumentos de percusión?",
        "options": [
          "Flauta",
          "Tambor",
          "Violín",
          "Trompeta"
        ],
        "correctAnswer": "Tambor",
        "explanation": "El tambor produce sonido principalmente al ser golpeado.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-004",
        "number": 4,
        "topic": "Música",
        "concept": "musica_melodia_pasa_sonidos_suaves_a_sonidos",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una melodía pasa de sonidos suaves a sonidos cada vez más fuertes. ¿Qué característica está cambiando?",
        "options": [
          "Duración",
          "Intensidad",
          "Altura",
          "Timbre"
        ],
        "correctAnswer": "Intensidad",
        "explanation": "La intensidad permite diferenciar sonidos fuertes y suaves.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-005",
        "number": 5,
        "topic": "Teatro",
        "concept": "teatro_elemento_permite_a_actor_representar_a",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué elemento permite a un actor representar a otra persona dentro de una obra?",
        "options": [
          "Escenario",
          "Personaje",
          "Público",
          "Utilería"
        ],
        "correctAnswer": "Personaje",
        "explanation": "El personaje es el papel representado por el actor.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-006",
        "number": 6,
        "topic": "Artes visuales",
        "concept": "artes_visuales_dibujante_quiere_montana_parezca_muy_lejana",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un dibujante quiere que una montaña parezca muy lejana. ¿Qué recurso ayuda más?",
        "options": [
          "Aumentar su tamaño",
          "Reducir su tamaño",
          "Engrosar su contorno",
          "Centrarla en la hoja"
        ],
        "correctAnswer": "Reducir su tamaño",
        "explanation": "Representar objetos más pequeños puede producir sensación de distancia.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-007",
        "number": 7,
        "topic": "Danza",
        "concept": "danza_elemento_permite_organizar_movimientos_siguiendo_pieza",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué elemento permite organizar movimientos siguiendo una pieza musical?",
        "options": [
          "Color",
          "Ritmo",
          "Textura",
          "Volumen"
        ],
        "correctAnswer": "Ritmo",
        "explanation": "El ritmo permite organizar movimientos en relación con el tiempo musical.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-008",
        "number": 8,
        "topic": "Patrimonio",
        "concept": "patrimonio_comunidad_conserva_danza_tradicional_ensenandola_generacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una comunidad conserva una danza tradicional enseñándola de generación en generación. Esa danza forma parte principalmente de su patrimonio:",
        "options": [
          "Natural",
          "Material",
          "Inmaterial",
          "Arquitectónico"
        ],
        "correctAnswer": "Inmaterial",
        "explanation": "Las tradiciones y expresiones transmitidas entre generaciones forman parte del patrimonio cultural inmaterial.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-009",
        "number": 9,
        "topic": "Literatura oral",
        "concept": "literatura_oral_historia_tradicional_explica_forma_simbolica_origen",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una historia tradicional que explica de forma simbólica el origen de un fenómeno suele considerarse:",
        "options": [
          "Crónica",
          "Mito",
          "Noticia",
          "Biografía"
        ],
        "correctAnswer": "Mito",
        "explanation": "Los mitos suelen ofrecer explicaciones simbólicas sobre orígenes y fenómenos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-010",
        "number": 10,
        "topic": "Artes visuales",
        "concept": "artes_visuales_afiche_titulo_debe_llamar_atencion_antes",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En un afiche, el título debe llamar la atención antes que los demás elementos. ¿Qué decisión ayuda más?",
        "options": [
          "Reducir su tamaño",
          "Ocultarlo al fondo",
          "Aumentar su tamaño",
          "Repetir el fondo"
        ],
        "correctAnswer": "Aumentar su tamaño",
        "explanation": "Un mayor tamaño puede establecer jerarquía visual y dirigir primero la atención hacia el título.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-011",
        "number": 11,
        "topic": "Color",
        "concept": "color_pareja_presenta_mayor_contraste",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué pareja presenta mayor contraste?",
        "options": [
          "Azul y celeste",
          "Amarillo y violeta",
          "Rojo y rosado",
          "Verde y verde claro"
        ],
        "correctAnswer": "Amarillo y violeta",
        "explanation": "Amarillo y violeta son colores complementarios en el círculo cromático tradicional.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-012",
        "number": 12,
        "topic": "Música colombiana",
        "concept": "musica_colombiana_estos_ritmos_esta_especialmente_asociado_region",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál de estos ritmos está especialmente asociado con la región Caribe colombiana?",
        "options": [
          "Bambuco",
          "Joropo",
          "Cumbia",
          "Currulao"
        ],
        "correctAnswer": "Cumbia",
        "explanation": "La cumbia tiene una fuerte asociación histórica y cultural con el Caribe colombiano.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-013",
        "number": 13,
        "topic": "Música colombiana",
        "concept": "musica_colombiana_region_colombiana_relaciona_joropo",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Con qué región colombiana se relaciona principalmente el joropo?",
        "options": [
          "Caribe",
          "Andina",
          "Orinoquía",
          "Pacífica"
        ],
        "correctAnswer": "Orinoquía",
        "explanation": "El joropo es una expresión musical y dancística característica de los Llanos y la Orinoquía.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-014",
        "number": 14,
        "topic": "Instrumentos",
        "concept": "instrumentos_instrumento_produce_sonido_mediante_cuerdas",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál instrumento produce sonido principalmente mediante cuerdas?",
        "options": [
          "Maraca",
          "Violín",
          "Flauta",
          "Tambor"
        ],
        "correctAnswer": "Violín",
        "explanation": "En el violín, la vibración de sus cuerdas es fundamental para producir el sonido.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-015",
        "number": 15,
        "topic": "Teatro",
        "concept": "teatro_si_obra_ocurre_bosque_elemento_ayuda",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Si una obra ocurre en un bosque, ¿qué elemento ayuda principalmente a comunicar ese lugar al público?",
        "options": [
          "Argumento",
          "Escenografía",
          "Personaje",
          "Diálogo"
        ],
        "correctAnswer": "Escenografía",
        "explanation": "La escenografía representa visualmente los espacios donde ocurre la acción.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-016",
        "number": 16,
        "topic": "Interpretación artística",
        "concept": "interpretacion_artistica_dos_estudiantes_observan_pintura_proponen_interpretaciones",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos estudiantes observan una pintura y proponen interpretaciones diferentes. ¿Cuál debería estar mejor sustentada?",
        "options": [
          "La más extensa",
          "La más popular",
          "La basada en la obra",
          "La dicha primero"
        ],
        "correctAnswer": "La basada en la obra",
        "explanation": "Una interpretación artística se fortalece cuando utiliza elementos observables de la obra como evidencia.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-017",
        "number": 17,
        "topic": "Artesanía",
        "concept": "artesania_caracteristica_distingue_mejor_artesania_producto_industrial",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué característica distingue mejor una artesanía de un producto industrial fabricado en serie?",
        "options": [
          "Precio elevado",
          "Producción artesanal",
          "Tamaño reducido",
          "Uso decorativo"
        ],
        "correctAnswer": "Producción artesanal",
        "explanation": "La artesanía se caracteriza especialmente por la intervención directa de técnicas y trabajo artesanal.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-018",
        "number": 18,
        "topic": "Patrimonio",
        "concept": "patrimonio_ejemplo_corresponde_a_patrimonio_cultural_material",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál ejemplo corresponde principalmente a patrimonio cultural material?",
        "options": [
          "Una leyenda",
          "Una danza",
          "Una fortaleza",
          "Una canción"
        ],
        "correctAnswer": "Una fortaleza",
        "explanation": "Una construcción histórica es un bien material; danzas, relatos y determinadas tradiciones pertenecen al patrimonio inmaterial.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-019",
        "number": 19,
        "topic": "Arte",
        "concept": "arte_obra_creada_mediante_imagenes_capturadas_camara",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una obra creada principalmente mediante imágenes capturadas con una cámara pertenece a:",
        "options": [
          "Escultura",
          "Fotografía",
          "Arquitectura",
          "Danza"
        ],
        "correctAnswer": "Fotografía",
        "explanation": "La fotografía utiliza dispositivos de captura de imágenes como medio principal.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-020",
        "number": 20,
        "topic": "Cultura colombiana",
        "concept": "cultura_colombiana_manifestacion_combina_especialmente_musica_movimiento_corporal",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál manifestación combina especialmente música, movimiento corporal y expresión cultural?",
        "options": [
          "Escultura",
          "Danza",
          "Arquitectura",
          "Fotografía"
        ],
        "correctAnswer": "Danza",
        "explanation": "La danza utiliza el movimiento corporal y suele relacionarse estrechamente con música y cultura.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-021",
        "number": 21,
        "topic": "TRUE/FALSE",
        "concept": "true_false_escultura_necesariamente_debe_ser_completamente_plana",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Una escultura necesariamente debe ser completamente plana.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La escultura normalmente trabaja con formas tridimensionales y volumen.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-022",
        "number": 22,
        "topic": "TRUE/FALSE",
        "concept": "true_false_tradicion_puede_ser_patrimonio_cultural_aunque",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una tradición puede ser patrimonio cultural aunque no sea un objeto físico.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El patrimonio cultural también puede ser inmaterial, como tradiciones, prácticas y expresiones.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-023",
        "number": 23,
        "topic": "TRUE/FALSE",
        "concept": "true_false_dos_instrumentos_pueden_tocar_misma_nota",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Dos instrumentos pueden tocar la misma nota y aun así sonar diferentes.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El timbre permite distinguir sonidos producidos por diferentes instrumentos incluso cuando tienen igual altura.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-024",
        "number": 24,
        "topic": "TRUE/FALSE",
        "concept": "true_false_si_dos_personas_interpretan_obra_manera",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si dos personas interpretan una obra de manera diferente, necesariamente una de ellas está equivocada.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Pueden existir interpretaciones diferentes siempre que puedan justificarse razonablemente con elementos de la obra y su contexto.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-025",
        "number": 25,
        "topic": "Cultura y patrimonio",
        "concept": "cultura_y_patrimonio_comunidad_reemplaza_materiales_tradicionales_artesania_pero",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una comunidad reemplaza los materiales tradicionales de una artesanía, pero conserva sus técnicas, diseños y significado cultural. ¿Qué aspecto permanece principalmente?",
        "options": [
          "El material original",
          "La producción industrial",
          "La tradición cultural",
          "El valor comercial"
        ],
        "correctAnswer": "La tradición cultural",
        "explanation": "Una manifestación cultural puede conservar elementos de su tradición aunque algunos materiales cambien.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-026",
        "number": 26,
        "topic": "Elementos visuales",
        "concept": "elementos_visuales_dibujo_recurso_permite_representar_mejor_superficie",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En un dibujo, ¿qué recurso permite representar mejor una superficie áspera?",
        "options": [
          "Contorno",
          "Proporción",
          "Textura",
          "Simetría"
        ],
        "correctAnswer": "Textura",
        "explanation": "La textura representa visualmente cómo se percibe una superficie.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-027",
        "number": 27,
        "topic": "Color",
        "concept": "color_color_secundario_modelo_tradicional_pigmentos",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es un color secundario en el modelo tradicional de pigmentos?",
        "options": [
          "Azul",
          "Rojo",
          "Naranja",
          "Amarillo"
        ],
        "correctAnswer": "Naranja",
        "explanation": "El naranja se obtiene tradicionalmente mezclando rojo y amarillo.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-028",
        "number": 28,
        "topic": "Composición",
        "concept": "composicion_figura_aparece_exactamente_igual_a_ambos",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una figura aparece exactamente igual a ambos lados de un eje central. ¿Qué principio presenta?",
        "options": [
          "Contraste",
          "Simetría",
          "Profundidad",
          "Movimiento"
        ],
        "correctAnswer": "Simetría",
        "explanation": "La simetría implica correspondencia de formas respecto a un eje.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-029",
        "number": 29,
        "topic": "Composición",
        "concept": "composicion_disenador_quiere_destacar_figura_roja_dentro",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un diseñador quiere destacar una figura roja dentro de una composición. ¿Qué fondo generaría mayor contraste?",
        "options": [
          "Naranja",
          "Violeta",
          "Verde",
          "Rosado"
        ],
        "correctAnswer": "Verde",
        "explanation": "Rojo y verde son colores complementarios y producen un contraste fuerte.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-030",
        "number": 30,
        "topic": "Música",
        "concept": "musica_caracteristica_permite_distinguir_voz_grave_aguda",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué característica permite distinguir una voz grave de una aguda?",
        "options": [
          "Ritmo",
          "Timbre",
          "Altura",
          "Intensidad"
        ],
        "correctAnswer": "Altura",
        "explanation": "La altura permite distinguir sonidos graves y agudos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-031",
        "number": 31,
        "topic": "Música",
        "concept": "musica_dos_musicos_tocan_misma_nota_igual",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos músicos tocan la misma nota con igual intensidad, uno con flauta y otro con violín. ¿Qué permite distinguirlos?",
        "options": [
          "Altura",
          "Duración",
          "Timbre",
          "Intensidad"
        ],
        "correctAnswer": "Timbre",
        "explanation": "El timbre permite identificar diferentes fuentes sonoras.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-032",
        "number": 32,
        "topic": "Instrumentos",
        "concept": "instrumentos_instrumento_produce_sonido_mediante_aire",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál instrumento produce sonido principalmente mediante aire?",
        "options": [
          "Guitarra",
          "Tambor",
          "Flauta",
          "Maraca"
        ],
        "correctAnswer": "Flauta",
        "explanation": "En la flauta, una columna de aire participa en la producción del sonido. Más natural que preguntar simplemente por la “familia de viento”. Pregunta 37 — mejora",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-033",
        "number": 33,
        "topic": "Música",
        "concept": "musica_cancion_mantiene_mismas_notas_pero_interpreta",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una canción mantiene las mismas notas, pero se interpreta más rápido. ¿Qué cambió principalmente?",
        "options": [
          "Timbre",
          "Tempo",
          "Altura",
          "Melodía"
        ],
        "correctAnswer": "Tempo",
        "explanation": "El tempo indica la velocidad de ejecución musical.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-034",
        "number": 34,
        "topic": "Música",
        "concept": "musica_musico_toca_primero_suavemente_luego_mucha",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un músico toca primero suavemente y luego con mucha fuerza, sin cambiar las notas. ¿Qué está modificando?",
        "options": [
          "Melodía",
          "Intensidad",
          "Altura",
          "Duración"
        ],
        "correctAnswer": "Intensidad",
        "explanation": "Cambiar de suave a fuerte modifica principalmente la intensidad.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-035",
        "number": 35,
        "topic": "Arte colombiano",
        "concept": "artista_colombiano_botero",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál de estos artistas es colombiano?",
        "options": [
          "Pablo Picasso",
          "Fernando Botero",
          "Vincent van Gogh",
          "Claude Monet"
        ],
        "correctAnswer": "Fernando Botero",
        "explanation": "Fernando Botero fue un artista colombiano reconocido internacionalmente.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-036",
        "number": 36,
        "topic": "Danza",
        "concept": "danza_dos_bailarines_realizan_movimientos_iguales_mismo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos bailarines realizan movimientos iguales al mismo tiempo. ¿Qué característica presentan?",
        "options": [
          "Improvisación",
          "Sincronización",
          "Contraste",
          "Perspectiva"
        ],
        "correctAnswer": "Sincronización",
        "explanation": "Existe sincronización cuando las acciones se coordinan temporalmente.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-037",
        "number": 37,
        "topic": "Teatro",
        "concept": "teatro_elemento_contiene_lo_dicen_personajes",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué elemento contiene lo que dicen los personajes?",
        "options": [
          "Escenario",
          "Vestuario",
          "Diálogo",
          "Utilería"
        ],
        "correctAnswer": "Diálogo",
        "explanation": "El diálogo contiene las intervenciones verbales de los personajes.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-038",
        "number": 38,
        "topic": "Teatro",
        "concept": "teatro_personaje_entra_temblando_habla_lentamente_evita",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un personaje entra temblando, habla lentamente y evita mirar a los demás. ¿Qué comunica principalmente?",
        "options": [
          "Escenografía",
          "Caracterización",
          "Iluminación",
          "Argumento"
        ],
        "correctAnswer": "Caracterización",
        "explanation": "Gestos, voz y comportamiento contribuyen a construir o caracterizar un personaje.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-039",
        "number": 39,
        "topic": "Teatro",
        "concept": "teatro_escena_no_hay_dialogo_pero_publico",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En una escena no hay diálogo, pero el público comprende que un personaje está preocupado. ¿Qué recurso pudo comunicarlo mejor?",
        "options": [
          "Escenografía",
          "Utilería",
          "Gestualidad",
          "Narración"
        ],
        "correctAnswer": "Gestualidad",
        "explanation": "Los gestos y movimientos corporales pueden comunicar emociones sin palabras.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-040",
        "number": 40,
        "topic": "Tradición oral",
        "concept": "tradicion_oral_historia_transmite_oralmente_durante_generaciones_mezcla",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una historia se transmite oralmente durante generaciones y mezcla acontecimientos con elementos fantásticos. ¿Qué corresponde mejor?",
        "options": [
          "Biografía",
          "Reportaje",
          "Leyenda",
          "Instructivo"
        ],
        "correctAnswer": "Leyenda",
        "explanation": "Las leyendas suelen transmitirse tradicionalmente y combinar referencias culturales o históricas con elementos fantásticos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-041",
        "number": 41,
        "topic": "Cultura colombiana",
        "concept": "cultura_colombiana_ritmo_relaciona_region_pacifica_colombiana",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál ritmo se relaciona principalmente con la región Pacífica colombiana?",
        "options": [
          "Joropo",
          "Currulao",
          "Vallenato",
          "Bambuco"
        ],
        "correctAnswer": "Currulao",
        "explanation": "El currulao constituye una importante expresión musical y dancística del Pacífico colombiano.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-042",
        "number": 42,
        "topic": "Cultura colombiana",
        "concept": "cultura_colombiana_instrumento_caracteristico_muchas_expresiones_musicales_caribe",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál instrumento es característico de muchas expresiones musicales del Caribe colombiano?",
        "options": [
          "Arpa",
          "Tiple",
          "Gaita",
          "Marimba"
        ],
        "correctAnswer": "Gaita",
        "explanation": "Las gaitas tienen una presencia destacada en diversas músicas tradicionales del Caribe colombiano.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-043",
        "number": 43,
        "topic": "Música",
        "concept": "silencio_musical",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué permite reconocer una pausa dentro de una pieza musical?",
        "options": [
          "Timbre",
          "Altura",
          "Silencio",
          "Melodía"
        ],
        "correctAnswer": "Silencio",
        "explanation": "El silencio también forma parte de la organización musical.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-044",
        "number": 44,
        "topic": "Patrimonio",
        "concept": "patrimonio_edificio_historico_sufre_danos_pero_existen",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un edificio histórico sufre daños, pero existen planos y fotografías detalladas. ¿Para qué serían especialmente útiles?",
        "options": [
          "Comercializarlo",
          "Modernizarlo",
          "Restaurarlo",
          "Trasladarlo"
        ],
        "correctAnswer": "Restaurarlo",
        "explanation": "Los registros permiten conocer características anteriores y pueden orientar procesos de restauración.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-045",
        "number": 45,
        "topic": "Arte precolombino",
        "concept": "orfebreria_precolombina",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué material fue utilizado por diferentes pueblos precolombinos de Colombia para elaborar piezas artísticas y ceremoniales?",
        "options": [
          "Plástico",
          "Aluminio",
          "Oro",
          "Acero"
        ],
        "correctAnswer": "Oro",
        "explanation": "Diferentes sociedades precolombinas desarrollaron importantes técnicas de orfebrería.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-046",
        "number": 46,
        "topic": "TRUE/FALSE",
        "concept": "true_false_ritmo_solamente_existe_musica",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "El ritmo solamente existe en la música.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "También puede existir ritmo visual, corporal y en otras manifestaciones artísticas.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-047",
        "number": 47,
        "topic": "TRUE/FALSE",
        "concept": "true_false_fotografia_puede_considerarse_manifestacion_artistica",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una fotografía puede considerarse una manifestación artística.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La fotografía puede utilizar composición, intención y recursos expresivos propios del arte.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-048",
        "number": 48,
        "topic": "TRUE/FALSE",
        "concept": "funcion_comunicativa_arte",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una obra artística puede comunicar ideas además de buscar belleza.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El arte puede comunicar ideas, emociones, críticas, historias y diferentes formas de comprender el mundo.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-049",
        "number": 49,
        "topic": "TRUE/FALSE",
        "concept": "true_false_obra_puede_tener_valor_cultural_aunque",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Una obra puede tener valor cultural aunque esté hecha con materiales cotidianos.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El valor cultural o artístico no depende exclusivamente del costo o rareza de sus materiales.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-050",
        "number": 50,
        "topic": "Interpretación artística",
        "concept": "interpretacion_artistica_pintura_usa_tonos_oscuros_figuras_inclinadas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una pintura usa principalmente tonos oscuros y figuras inclinadas para crear tensión. ¿Qué interpretación está mejor sustentada?",
        "options": [
          "Representa necesariamente la noche",
          "Fue pintada rápidamente",
          "Busca generar inquietud",
          "Tiene mayor valor económico"
        ],
        "correctAnswer": "Busca generar inquietud",
        "explanation": "Los colores y la disposición de las figuras proporcionan evidencia visual para interpretar una sensación de tensión.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-051",
        "number": 51,
        "topic": "Arte colombiano",
        "concept": "museo_oro_orfebreria",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Con qué material se relacionan especialmente muchas piezas del Museo del Oro?",
        "options": [
          "Vidrio",
          "Plástico",
          "Metal",
          "Papel"
        ],
        "correctAnswer": "Metal",
        "explanation": "Su colección es especialmente reconocida por piezas de orfebrería de sociedades prehispánicas.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-052",
        "number": 52,
        "topic": "Color",
        "concept": "color_pareja_esta_formada_colores_primarios_tradicionales",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál pareja está formada por colores primarios tradicionales?",
        "options": [
          "Verde y azul",
          "Naranja y rojo",
          "Rojo y azul",
          "Violeta y amarillo"
        ],
        "correctAnswer": "Rojo y azul",
        "explanation": "Rojo, amarillo y azul se consideran primarios en el modelo tradicional trabajado en artes.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-053",
        "number": 53,
        "topic": "Composición",
        "concept": "composicion_afiche_hay_muchos_elementos_pero_sobresale",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En un afiche hay muchos elementos, pero uno sobresale por su tamaño. ¿Qué se produce principalmente?",
        "options": [
          "Simetría",
          "Jerarquía",
          "Textura",
          "Perspectiva"
        ],
        "correctAnswer": "Jerarquía",
        "explanation": "La diferencia de tamaño puede establecer qué elemento se observa primero.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-054",
        "number": 54,
        "topic": "Color",
        "concept": "color_ilustrador_quiere_transmitir_sensacion_frio_combinacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un ilustrador quiere transmitir sensación de frío. ¿Qué combinación sería más apropiada?",
        "options": [
          "Rojo y naranja",
          "Amarillo y rojo",
          "Azul y violeta",
          "Naranja y amarillo"
        ],
        "correctAnswer": "Azul y violeta",
        "explanation": "Azules y violetas suelen clasificarse como colores fríos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-055",
        "number": 55,
        "topic": "Artes visuales",
        "concept": "artes_visuales_artista_repite_varias_veces_misma_forma",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un artista repite varias veces una misma forma en su obra. ¿Qué puede generar visualmente?",
        "options": [
          "Volumen",
          "Perspectiva",
          "Ritmo",
          "Contorno"
        ],
        "correctAnswer": "Ritmo",
        "explanation": "La repetición organizada de elementos puede producir ritmo visual.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-056",
        "number": 56,
        "topic": "Música",
        "concept": "musica_elemento_organiza_sonidos_silencios_tiempo",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué elemento organiza los sonidos y silencios en el tiempo?",
        "options": [
          "Timbre",
          "Altura",
          "Intensidad",
          "Ritmo"
        ],
        "correctAnswer": "Ritmo",
        "explanation": "El ritmo organiza temporalmente sonidos y silencios.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-057",
        "number": 57,
        "topic": "Música",
        "concept": "musica_dos_sonidos_tienen_igual_duracion_e",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos sonidos tienen igual duración e intensidad, pero uno es grave y otro agudo. ¿Qué cambia?",
        "options": [
          "Timbre",
          "Altura",
          "Ritmo",
          "Volumen"
        ],
        "correctAnswer": "Altura",
        "explanation": "La altura permite diferenciar sonidos graves y agudos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-058",
        "number": 58,
        "topic": "Música",
        "concept": "musica_estudiante_golpea_mesa_siguiendo_regularmente_fuerte",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un estudiante golpea una mesa siguiendo regularmente: fuerte-suave-suave, fuerte-suave-suave. ¿Qué está creando?",
        "options": [
          "Timbre",
          "Ritmo",
          "Altura",
          "Melodía"
        ],
        "correctAnswer": "Ritmo",
        "explanation": "La repetición temporal de un patrón de golpes constituye un ritmo.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-059",
        "number": 59,
        "topic": "Instrumentos",
        "concept": "instrumentos_pareja_pertenece_a_misma_familia_instrumental",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál pareja pertenece principalmente a la misma familia instrumental?",
        "options": [
          "Flauta y tambor",
          "Trompeta y arpa",
          "Maraca y clarinete",
          "Violín y guitarra"
        ],
        "correctAnswer": "Violín y guitarra",
        "explanation": "Violín y guitarra producen sonido principalmente mediante cuerdas.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-060",
        "number": 60,
        "topic": "Música colombiana",
        "concept": "musica_colombiana_instrumento_asocia_especialmente_musicas_tradicionales_pacifico",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué instrumento se asocia especialmente con músicas tradicionales del Pacífico colombiano?",
        "options": [
          "Acordeón",
          "Marimba",
          "Arpa",
          "Tiple"
        ],
        "correctAnswer": "Marimba",
        "explanation": "La marimba tiene una importante presencia en expresiones musicales tradicionales del Pacífico colombiano.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-061",
        "number": 61,
        "topic": "Cultura artística",
        "concept": "funcion_museo",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Dónde es más probable encontrar una colección permanente de pinturas históricas?",
        "options": [
          "Estadio",
          "Aeropuerto",
          "Gimnasio",
          "Museo"
        ],
        "correctAnswer": "Museo",
        "explanation": "Los museos pueden conservar y exhibir colecciones artísticas e históricas.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-062",
        "number": 62,
        "topic": "Danza",
        "concept": "danza_danza_utiliza_movimientos_rapidos_coinciden_cambios",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una danza utiliza movimientos rápidos que coinciden con cambios rápidos de la música. ¿Qué relación se evidencia?",
        "options": [
          "Color y textura",
          "Espacio y volumen",
          "Forma y contraste",
          "Movimiento y ritmo"
        ],
        "correctAnswer": "Movimiento y ritmo",
        "explanation": "Los movimientos pueden organizarse de acuerdo con el ritmo musical.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-063",
        "number": 63,
        "topic": "Danza",
        "concept": "danza_cuatro_bailarines_deben_realizar_figura_mismo",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Cuatro bailarines deben realizar una figura al mismo tiempo. ¿Qué necesitan principalmente?",
        "options": [
          "Improvisación",
          "Contraste",
          "Escenografía",
          "Sincronización"
        ],
        "correctAnswer": "Sincronización",
        "explanation": "La sincronización permite coordinar acciones en un mismo momento.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-064",
        "number": 64,
        "topic": "Teatro",
        "concept": "teatro_actor_cambia_manera_caminar_hablar_representar",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un actor cambia su manera de caminar y hablar para representar a un anciano. ¿Qué está construyendo?",
        "options": [
          "Escenario",
          "Argumento",
          "Público",
          "Personaje"
        ],
        "correctAnswer": "Personaje",
        "explanation": "Los recursos corporales y vocales ayudan al actor a construir un personaje.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-065",
        "number": 65,
        "topic": "Teatro",
        "concept": "teatro_durante_escena_luces_cambian_claras_a",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Durante una escena, las luces cambian de claras a oscuras justo cuando aparece un peligro. ¿Qué función cumplen?",
        "options": [
          "Cambiar el diálogo",
          "Definir el vestuario",
          "Reemplazar al actor",
          "Crear ambiente"
        ],
        "correctAnswer": "Crear ambiente",
        "explanation": "La iluminación puede reforzar el ambiente y las emociones de una escena.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-066",
        "number": 66,
        "topic": "Literatura oral",
        "concept": "literatura_oral_caracteristica_permite_diferenciar_mejor_mito_noticia",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué característica permite diferenciar mejor un mito de una noticia?",
        "options": [
          "Presencia de personajes",
          "Uso de palabras",
          "Relato de sucesos",
          "Explicación simbólica"
        ],
        "correctAnswer": "Explicación simbólica",
        "explanation": "El mito puede explicar simbólicamente orígenes o fenómenos mediante relatos tradicionales.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-067",
        "number": 67,
        "topic": "Tradición oral",
        "concept": "tradicion_oral_abuela_cuenta_a_nietos_historia_escucho",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una abuela cuenta a sus nietos una historia que escuchó de sus propios abuelos. ¿Qué proceso ocurre?",
        "options": [
          "Producción industrial",
          "Restauración artística",
          "Representación gráfica",
          "Transmisión oral"
        ],
        "correctAnswer": "Transmisión oral",
        "explanation": "El relato se conserva y transmite principalmente mediante la palabra hablada.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-068",
        "number": 68,
        "topic": "Cultura",
        "concept": "comparacion_practicas_culturales",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos comunidades utilizan instrumentos diferentes para interpretar canciones con funciones similares en sus celebraciones. ¿Qué permite comparar esto?",
        "options": [
          "Sus límites geográficos",
          "Sus tamaños poblacionales",
          "Sus sistemas políticos",
          "Sus prácticas culturales"
        ],
        "correctAnswer": "Sus prácticas culturales",
        "explanation": "Las expresiones musicales permiten comparar prácticas culturales entre comunidades.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-069",
        "number": 69,
        "topic": "Artesanía",
        "concept": "artesania_dos_vasijas_tienen_misma_funcion_pero",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos vasijas tienen la misma función, pero una fue elaborada manualmente con técnicas tradicionales. ¿Qué la distingue principalmente?",
        "options": [
          "Su capacidad",
          "Su utilidad",
          "Su forma circular",
          "Su proceso de elaboración"
        ],
        "correctAnswer": "Su proceso de elaboración",
        "explanation": "El proceso y las técnicas tradicionales son elementos centrales de una producción artesanal.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-070",
        "number": 70,
        "topic": "Cultura",
        "concept": "cultura_misma_cancion_tradicional_presenta_versiones_distintas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una misma canción tradicional presenta versiones distintas en dos comunidades. ¿Qué explica mejor esta situación?",
        "options": [
          "Error musical",
          "Pérdida automática",
          "Copia industrial",
          "Adaptación cultural"
        ],
        "correctAnswer": "Adaptación cultural",
        "explanation": "Las expresiones culturales pueden adquirir variaciones al transmitirse entre comunidades y generaciones.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-071",
        "number": 71,
        "topic": "TRUE/FALSE",
        "concept": "true_false_textura_puede_representarse_visualmente_dibujo",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La textura puede representarse visualmente en un dibujo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Líneas, puntos y otros recursos pueden sugerir visualmente diferentes texturas.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-072",
        "number": 72,
        "topic": "TRUE/FALSE",
        "concept": "true_false_objeto_pequeno_dibujo_necesariamente_pequeno_realidad",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Un objeto más pequeño en un dibujo necesariamente es más pequeño en la realidad.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "El tamaño representado también puede utilizarse para mostrar distancia o profundidad.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-073",
        "number": 73,
        "topic": "TRUE/FALSE",
        "concept": "true_false_danza_puede_transmitir_informacion_cultura_comunidad",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una danza puede transmitir información sobre la cultura de una comunidad.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las danzas pueden expresar tradiciones, historias, prácticas e identidades culturales.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-074",
        "number": 74,
        "topic": "TRUE/FALSE",
        "concept": "material_mensaje_artistico",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Una obra creada con materiales reciclados puede comunicar una idea sobre el ambiente.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La selección de materiales también puede formar parte del mensaje de una obra.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-075",
        "number": 75,
        "topic": "Interpretación artística",
        "concept": "interpretacion_artistica_dos_afiches_anuncian_mismo_evento_permite",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos afiches anuncian el mismo evento. Uno permite identificar la información importante mucho más rápido. ¿Qué característica probablemente maneja mejor?",
        "options": [
          "Textura visual",
          "Simetría radial",
          "Volumen aparente",
          "Jerarquía visual"
        ],
        "correctAnswer": "Jerarquía visual",
        "explanation": "Una buena jerarquía visual ayuda a reconocer primero la información más importante.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-076",
        "number": 76,
        "topic": "Arte ancestral",
        "concept": "arte_como_fuente_cultural",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Las figuras y diseños presentes en objetos antiguos pueden servir para estudiar:",
        "options": [
          "El clima actual",
          "La tecnología moderna",
          "El tráfico urbano",
          "Su cultura"
        ],
        "correctAnswer": "Su cultura",
        "explanation": "Los objetos antiguos pueden aportar información sobre las sociedades que los produjeron.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-077",
        "number": 77,
        "topic": "Patrimonio",
        "concept": "patrimonio_ejemplo_patrimonio_material",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es un ejemplo de patrimonio material?",
        "options": [
          "Una danza",
          "Una leyenda",
          "Una catedral",
          "Una canción"
        ],
        "correctAnswer": "Una catedral",
        "explanation": "Una construcción histórica es un bien cultural material.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-078",
        "number": 78,
        "topic": "Arquitectura",
        "concept": "arquitectura_edificio_tiene_arcos_columnas_grandes_espacios",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Un edificio tiene arcos, columnas y grandes espacios interiores. ¿A qué manifestación artística pertenece principalmente?",
        "options": [
          "Escultura",
          "Arquitectura",
          "Fotografía",
          "Pintura"
        ],
        "correctAnswer": "Arquitectura",
        "explanation": "La arquitectura comprende el diseño y construcción de espacios y edificaciones.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-079",
        "number": 79,
        "topic": "Patrimonio",
        "concept": "patrimonio_escultura_historica_ubicada_aire_libre_comienza",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una escultura histórica ubicada al aire libre comienza a deteriorarse por la lluvia. ¿Qué acción favorece mejor su conservación?",
        "options": [
          "Cambiar su diseño",
          "Pintarla libremente",
          "Ocultar sus daños",
          "Evaluar su estado"
        ],
        "correctAnswer": "Evaluar su estado",
        "explanation": "Antes de intervenir un bien patrimonial es necesario conocer su estado de conservación.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-080",
        "number": 80,
        "topic": "Arte ancestral",
        "concept": "arte_ancestral_conocer_comunidad_antigua_representaba_animales_fuente",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Para conocer cómo una comunidad antigua representaba animales, ¿qué fuente sería más útil?",
        "options": [
          "Un mapa actual",
          "Una noticia reciente",
          "Un anuncio comercial",
          "Sus cerámicas"
        ],
        "correctAnswer": "Sus cerámicas",
        "explanation": "Las piezas producidas por una comunidad pueden aportar información sobre sus representaciones culturales.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-081",
        "number": 81,
        "topic": "Música colombiana",
        "concept": "musica_colombiana_instrumento_tiene_relacion_especialmente_fuerte_vallenato",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué instrumento tiene una relación especialmente fuerte con el vallenato?",
        "options": [
          "Marimba",
          "Arpa",
          "Flauta",
          "Acordeón"
        ],
        "correctAnswer": "Acordeón",
        "explanation": "El acordeón es uno de los instrumentos característicos del vallenato.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-082",
        "number": 82,
        "topic": "Cultura colombiana",
        "concept": "carnaval_barranquilla_manifestaciones",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "El Carnaval de Barranquilla integra principalmente:",
        "options": [
          "Pintura, cálculo y deporte",
          "Arquitectura, física y cine",
          "Escultura, astronomía y teatro",
          "Música, danza y tradición"
        ],
        "correctAnswer": "Música, danza y tradición",
        "explanation": "El Carnaval reúne numerosas expresiones musicales, dancísticas y tradicionales.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-083",
        "number": 83,
        "topic": "Música colombiana",
        "concept": "musica_colombiana_region_asocia_tradicionalmente_bambuco",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Con qué región se asocia tradicionalmente el bambuco?",
        "options": [
          "Caribe",
          "Insular",
          "Orinoquía",
          "Andina"
        ],
        "correctAnswer": "Andina",
        "explanation": "El bambuco tiene una importante relación histórica con la región Andina colombiana.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-084",
        "number": 84,
        "topic": "Cultura colombiana",
        "concept": "cultura_colombiana_presentacion_aparecen_marimba_cununos_cantos_tradicionales",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una presentación aparecen marimba, cununos y cantos tradicionales. ¿Qué región colombiana está mejor representada?",
        "options": [
          "Andina",
          "Orinoquía",
          "Amazónica",
          "Pacífica"
        ],
        "correctAnswer": "Pacífica",
        "explanation": "Estos instrumentos y expresiones tienen una fuerte relación con músicas tradicionales del Pacífico.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-085",
        "number": 85,
        "topic": "Danza",
        "concept": "espacio_en_danza",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un bailarín cambia de dirección, nivel y ubicación durante una presentación. ¿Qué elemento está utilizando?",
        "options": [
          "Timbre",
          "Textura",
          "Color",
          "Espacio"
        ],
        "correctAnswer": "Espacio",
        "explanation": "En la danza, el cuerpo utiliza y transforma el espacio mediante sus movimientos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-086",
        "number": 86,
        "topic": "Arte universal",
        "concept": "arte_universal_manifestacion_artistica_trabaja_formas_tridimensionales",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál manifestación artística trabaja principalmente con formas tridimensionales?",
        "options": [
          "Pintura",
          "Escultura",
          "Dibujo",
          "Fotografía"
        ],
        "correctAnswer": "Escultura",
        "explanation": "La escultura trabaja principalmente con volumen y formas tridimensionales.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-087",
        "number": 87,
        "topic": "Escultura",
        "concept": "escultura_artista_quiere_crear_obra_pueda_observarse",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un artista quiere crear una obra que pueda observarse desde diferentes lados. ¿Qué opción sería más adecuada?",
        "options": [
          "Fotografía",
          "Dibujo",
          "Grabado",
          "Escultura"
        ],
        "correctAnswer": "Escultura",
        "explanation": "Una escultura tridimensional puede observarse desde diferentes puntos de vista.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-088",
        "number": 88,
        "topic": "Artes visuales",
        "concept": "artes_visuales_retrato_muestra_cabeza_demasiado_grande_respecto",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un retrato muestra una cabeza demasiado grande respecto al cuerpo sin intención artística. ¿Qué aspecto presenta un problema?",
        "options": [
          "Textura",
          "Ritmo",
          "Contraste",
          "Proporción"
        ],
        "correctAnswer": "Proporción",
        "explanation": "La proporción se refiere a la relación de tamaño entre las partes.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-089",
        "number": 89,
        "topic": "Fotografía",
        "concept": "fotografia_fotografo_cambia_posicion_desde_toma_imagen",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Un fotógrafo cambia la posición desde donde toma una imagen. ¿Qué modifica principalmente?",
        "options": [
          "Patrimonio",
          "Ritmo musical",
          "Material",
          "Punto de vista"
        ],
        "correctAnswer": "Punto de vista",
        "explanation": "Cambiar la posición de la cámara modifica el punto de vista de la imagen.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-090",
        "number": 90,
        "topic": "Fotografía",
        "concept": "fotografia_dos_fotografias_muestran_mismo_objeto_lo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos fotografías muestran el mismo objeto. Una lo hace parecer enorme porque fue tomada muy cerca y desde abajo. ¿Qué influyó principalmente?",
        "options": [
          "Textura real",
          "Edad del objeto",
          "Material original",
          "Punto de vista"
        ],
        "correctAnswer": "Punto de vista",
        "explanation": "La posición y el ángulo de la cámara pueden cambiar la percepción visual de un objeto.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-091",
        "number": 91,
        "topic": "Teatro",
        "concept": "teatro_recurso_permite_cambiar_rapidamente_apariencia_personaje",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué recurso permite cambiar rápidamente la apariencia de un personaje sin modificar el escenario?",
        "options": [
          "Escenografía",
          "Iluminación",
          "Argumento",
          "Vestuario"
        ],
        "correctAnswer": "Vestuario",
        "explanation": "El vestuario contribuye a representar visualmente las características de un personaje.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-092",
        "number": 92,
        "topic": "Teatro",
        "concept": "teatro_actor_dice_estoy_feliz_pero_habla",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un actor dice «estoy feliz», pero habla en tono triste y mantiene la mirada baja. ¿Qué genera principalmente?",
        "options": [
          "Contradicción expresiva",
          "Cambio de escenario",
          "Cambio de personaje",
          "Ritmo visual"
        ],
        "correctAnswer": "Contradicción expresiva",
        "explanation": "Las palabras y la expresión corporal o vocal transmiten mensajes diferentes.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-093",
        "number": 93,
        "topic": "Cultura",
        "concept": "cultura_comunidad_quiere_conocer_vestian_antepasados_fuente",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una comunidad quiere conocer cómo vestían sus antepasados. ¿Qué fuente sería más útil?",
        "options": [
          "Fotografías antiguas",
          "Pronóstico del tiempo",
          "Mapa de carreteras",
          "Tabla de precios"
        ],
        "correctAnswer": "Fotografías antiguas",
        "explanation": "Las fotografías históricas pueden aportar evidencia visual sobre vestuario y costumbres.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-094",
        "number": 94,
        "topic": "Interpretación",
        "concept": "interpretacion_pintura_muestra_arboles_inclinados_nubes_oscuras",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una pintura muestra árboles inclinados, nubes oscuras y personas corriendo. ¿Qué interpretación tiene mayor apoyo visual?",
        "options": [
          "Se aproxima una tormenta",
          "Comienza una celebración",
          "Es un día tranquilo",
          "Termina una competencia"
        ],
        "correctAnswer": "Se aproxima una tormenta",
        "explanation": "Los elementos representados aportan evidencias compatibles con la llegada de una tormenta.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-095",
        "number": 95,
        "topic": "Cultura universal",
        "concept": "cultura_universal_obra_representa_escenas_personajes_mediante_movimientos",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una obra representa escenas y personajes mediante movimientos, música y actuación, pero no utiliza diálogo hablado. ¿Qué sigue siendo fundamental?",
        "options": [
          "Expresión corporal",
          "Texto escrito",
          "Narración oral",
          "Lectura pública"
        ],
        "correctAnswer": "Expresión corporal",
        "explanation": "El cuerpo puede comunicar acciones, emociones e ideas sin necesidad de diálogo.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-096",
        "number": 96,
        "topic": "TRUE/FALSE",
        "concept": "true_false_arquitectura_puede_considerarse_manifestacion_artistica",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La arquitectura puede considerarse una manifestación artística.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La arquitectura puede integrar función, diseño, técnica y expresión estética.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-097",
        "number": 97,
        "topic": "TRUE/FALSE",
        "concept": "true_false_fotografia_siempre_muestra_realidad_manera_completamente",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una fotografía siempre muestra la realidad de manera completamente neutral.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "El encuadre, el momento y el punto de vista influyen en lo que muestra una fotografía.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-098",
        "number": 98,
        "topic": "TRUE/FALSE",
        "concept": "true_false_vestuario_puede_aportar_informacion_personaje_teatral",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El vestuario puede aportar información sobre un personaje teatral.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Puede comunicar época, ocupación, características o contexto del personaje.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-099",
        "number": 99,
        "topic": "TRUE/FALSE",
        "concept": "true_false_si_pintura_representa_hecho_historico_si",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si una pintura representa un hecho histórico, por sí sola demuestra exactamente cómo ocurrió.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Una obra artística puede ofrecer una representación o interpretación y debe contrastarse con otras fuentes.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-100",
        "number": 100,
        "topic": "Arte y ambiente",
        "concept": "volumen_escultura",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una escultura pública fue diseñada para observarse mientras las personas caminan alrededor de ella. ¿Qué característica resulta importante?",
        "options": [
          "Volumen",
          "Ortografía",
          "Melodía",
          "Narración"
        ],
        "correctAnswer": "Volumen",
        "explanation": "El volumen permite que una obra tridimensional pueda apreciarse desde distintos puntos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-101",
        "number": 101,
        "topic": "Artes visuales",
        "concept": "artes_visuales_dibujo_utiliza_lineas_horizontales_formas_estables",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un dibujo utiliza principalmente líneas horizontales y formas estables. ¿Qué sensación puede reforzar?",
        "options": [
          "Calma",
          "Velocidad",
          "Caos",
          "Tensión"
        ],
        "correctAnswer": "Calma",
        "explanation": "Las líneas horizontales suelen asociarse visualmente con estabilidad y reposo.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-102",
        "number": 102,
        "topic": "Formas",
        "concept": "formas_figura_corresponde_a_forma_geometrica",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál figura corresponde a una forma geométrica?",
        "options": [
          "Triángulo",
          "Nube",
          "Hoja",
          "Mancha"
        ],
        "correctAnswer": "Triángulo",
        "explanation": "El triángulo es una forma geométrica definida.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-103",
        "number": 103,
        "topic": "Formas",
        "concept": "formas_artista_representa_arboles_mediante_figuras_irregulares",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un artista representa árboles mediante figuras irregulares inspiradas en la naturaleza. ¿Qué tipo de formas utiliza?",
        "options": [
          "Orgánicas",
          "Geométricas",
          "Simétricas",
          "Numéricas"
        ],
        "correctAnswer": "Orgánicas",
        "explanation": "Las formas orgánicas suelen ser irregulares y estar relacionadas con elementos naturales.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-104",
        "number": 104,
        "topic": "Composición",
        "concept": "composicion_afiche_tiene_textos_imagenes_colores_compitiendo",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un afiche tiene textos, imágenes y colores compitiendo por llamar la atención al mismo tiempo. ¿Qué problema presenta principalmente?",
        "options": [
          "Jerarquía visual",
          "Perspectiva lineal",
          "Textura táctil",
          "Simetría axial"
        ],
        "correctAnswer": "Jerarquía visual",
        "explanation": "Sin una jerarquía clara resulta difícil reconocer qué información debe observarse primero.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-105",
        "number": 105,
        "topic": "Color",
        "concept": "color_ocurre_anadir_blanco_progresivamente_a_color",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ocurre al añadir blanco progresivamente a un color?",
        "options": [
          "Se aclara",
          "Se complementa",
          "Se invierte",
          "Se neutraliza"
        ],
        "correctAnswer": "Se aclara",
        "explanation": "Añadir blanco permite obtener valores más claros del color.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-106",
        "number": 106,
        "topic": "Color",
        "concept": "color_grupo_contiene_colores_calidos",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál grupo contiene principalmente colores cálidos?",
        "options": [
          "Rojo, naranja, amarillo",
          "Azul, verde, violeta",
          "Azul, celeste, verde",
          "Violeta, azul, celeste"
        ],
        "correctAnswer": "Rojo, naranja, amarillo",
        "explanation": "Rojos, naranjas y amarillos suelen clasificarse como colores cálidos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-107",
        "number": 107,
        "topic": "Diseño",
        "concept": "diseno_aviso_debe_poder_leerse_rapidamente_desde",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un aviso debe poder leerse rápidamente desde lejos. ¿Qué característica conviene priorizar?",
        "options": [
          "Legibilidad",
          "Textura",
          "Simetría",
          "Volumen"
        ],
        "correctAnswer": "Legibilidad",
        "explanation": "La legibilidad facilita reconocer y comprender el texto rápidamente.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-108",
        "number": 108,
        "topic": "Música",
        "concept": "musica_denomina_sucesion_organizada_sonidos_podemos_reconocer",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se denomina una sucesión organizada de sonidos que podemos reconocer musicalmente?",
        "options": [
          "Melodía",
          "Textura",
          "Escena",
          "Perspectiva"
        ],
        "correctAnswer": "Melodía",
        "explanation": "Una melodía es una sucesión organizada de sonidos con sentido musical.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-109",
        "number": 109,
        "topic": "Música",
        "concept": "armonia_basica",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una canción tiene varias voces que suenan simultáneamente de forma organizada. ¿Qué elemento aparece?",
        "options": [
          "Armonía",
          "Perspectiva",
          "Simetría",
          "Escala visual"
        ],
        "correctAnswer": "Armonía",
        "explanation": "La armonía se relaciona con la combinación simultánea y organizada de sonidos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-110",
        "number": 110,
        "topic": "Música",
        "concept": "musica_dos_grupos_interpretan_misma_cancion_instrumentos",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos grupos interpretan la misma canción con instrumentos diferentes. ¿Qué elemento permite reconocer que sigue siendo la misma canción?",
        "options": [
          "Melodía",
          "Timbre",
          "Intensidad",
          "Instrumentación"
        ],
        "correctAnswer": "Melodía",
        "explanation": "La melodía puede mantenerse aunque cambien los instrumentos y sus timbres.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-111",
        "number": 111,
        "topic": "Expresión corporal",
        "concept": "expresion_corporal_actor_permanece_silencio_pero_retrocede_ver",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un actor permanece en silencio, pero retrocede al ver entrar a otro personaje. ¿Qué comunica principalmente la acción?",
        "options": [
          "Reacción corporal",
          "Cambio musical",
          "Cambio escénico",
          "Narración escrita"
        ],
        "correctAnswer": "Reacción corporal",
        "explanation": "El movimiento corporal puede comunicar una reacción sin necesidad de palabras.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-112",
        "number": 112,
        "topic": "Teatro",
        "concept": "teatro_publico_escucha_pasos_antes_aparezca_personaje",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "El público escucha pasos antes de que aparezca un personaje. ¿Qué recurso crea expectativa?",
        "options": [
          "Sonido",
          "Vestuario",
          "Maquillaje",
          "Escenografía"
        ],
        "correctAnswer": "Sonido",
        "explanation": "Un efecto sonoro puede anticipar una acción o presencia que todavía no se observa.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-113",
        "number": 113,
        "topic": "Teatro",
        "concept": "teatro_indicacion_pertenece_a_acotacion_teatral",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué indicación pertenece principalmente a una acotación teatral?",
        "options": [
          "«Entra lentamente»",
          "«¿Dónde estabas?»",
          "«No lo recuerdo»",
          "«Volveré mañana»"
        ],
        "correctAnswer": "«Entra lentamente»",
        "explanation": "Las acotaciones orientan acciones, movimientos u otros aspectos de la representación.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-114",
        "number": 114,
        "topic": "Narración",
        "concept": "narracion_relato_comienza_final_despues_muestra_ocurrieron",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un relato comienza con el final y después muestra cómo ocurrieron los hechos. ¿Qué cambió principalmente?",
        "options": [
          "Orden temporal",
          "Tipo de personaje",
          "Lugar del relato",
          "Tema principal"
        ],
        "correctAnswer": "Orden temporal",
        "explanation": "Los acontecimientos no necesariamente tienen que narrarse en orden cronológico.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-115",
        "number": 115,
        "topic": "Literatura oral",
        "concept": "literatura_oral_caracteristica_ayuda_especialmente_a_conservar_oralmente",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál característica ayuda especialmente a conservar oralmente un poema o canción tradicional?",
        "options": [
          "Repetición",
          "Perspectiva",
          "Volumen",
          "Escenografía"
        ],
        "correctAnswer": "Repetición",
        "explanation": "Las repeticiones y patrones pueden facilitar la memorización y transmisión oral.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-116",
        "number": 116,
        "topic": "Técnicas artísticas",
        "concept": "tecnicas_artisticas_tecnica_utiliza_pigmentos_aplicados_superficie",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué técnica utiliza principalmente pigmentos aplicados sobre una superficie?",
        "options": [
          "Pintura",
          "Escultura",
          "Danza",
          "Teatro"
        ],
        "correctAnswer": "Pintura",
        "explanation": "La pintura utiliza pigmentos para producir imágenes sobre diferentes superficies.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-117",
        "number": 117,
        "topic": "Técnicas artísticas",
        "concept": "tecnicas_artisticas_imagen_forma_pegando_recortes_distintos_materiales",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una imagen se forma pegando recortes de distintos materiales. ¿Qué técnica se utiliza?",
        "options": [
          "Collage",
          "Grabado",
          "Modelado",
          "Acuarela"
        ],
        "correctAnswer": "Collage",
        "explanation": "El collage combina y pega diferentes materiales sobre una superficie.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-118",
        "number": 118,
        "topic": "Escultura",
        "concept": "escultura_estudiante_da_forma_a_figura_utilizando",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un estudiante da forma a una figura utilizando arcilla blanda. ¿Qué procedimiento realiza?",
        "options": [
          "Modelado",
          "Grabado",
          "Collage",
          "Tejido"
        ],
        "correctAnswer": "Modelado",
        "explanation": "El modelado consiste en dar forma a materiales maleables como la arcilla.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-119",
        "number": 119,
        "topic": "Técnicas",
        "concept": "tecnicas_artista_quiere_producir_varias_copias_imagen",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un artista quiere producir varias copias de una imagen a partir de una matriz. ¿Qué técnica resulta más apropiada?",
        "options": [
          "Grabado",
          "Modelado",
          "Collage",
          "Escultura"
        ],
        "correctAnswer": "Grabado",
        "explanation": "El grabado permite obtener impresiones a partir de una matriz preparada.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-120",
        "number": 120,
        "topic": "Cultura",
        "concept": "cultura_cancion_incorpora_elementos_musicales_dos_tradiciones",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una canción incorpora elementos musicales de dos tradiciones diferentes. ¿Qué concepto describe mejor el resultado?",
        "options": [
          "Fusión cultural",
          "Restauración",
          "Simetría",
          "Perspectiva"
        ],
        "correctAnswer": "Fusión cultural",
        "explanation": "Una fusión combina elementos procedentes de diferentes tradiciones o estilos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-121",
        "number": 121,
        "topic": "TRUE/FALSE",
        "concept": "true_false_collage_puede_combinar_materiales_diferentes_misma",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "El collage puede combinar materiales diferentes en una misma obra.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Precisamente una característica del collage es combinar distintos elementos o materiales.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-122",
        "number": 122,
        "topic": "TRUE/FALSE",
        "concept": "uso_expresivo_silencio",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El silencio puede utilizarse intencionalmente dentro de una obra musical.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Los silencios forman parte de la organización y expresión musical.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-123",
        "number": 123,
        "topic": "TRUE/FALSE",
        "concept": "true_false_efectos_sonido_pueden_aportar_informacion_obra",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Los efectos de sonido pueden aportar información en una obra teatral.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Los sonidos pueden indicar acciones, lugares, ambientes o acontecimientos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-124",
        "number": 124,
        "topic": "TRUE/FALSE",
        "concept": "true_false_imagen_llamativa_garantiza_mensaje_sea_facil",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Una imagen llamativa garantiza que su mensaje sea fácil de comprender.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Una imagen puede llamar la atención y, aun así, presentar problemas de organización o claridad.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-125",
        "number": 125,
        "topic": "Interpretación visual",
        "concept": "interpretacion_visual_cartel_utiliza_letras_amarillas_fondo_blanco",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un cartel utiliza letras amarillas sobre un fondo blanco y cuesta leerlo. ¿Qué debería mejorarse principalmente?",
        "options": [
          "Contraste",
          "Ritmo",
          "Perspectiva",
          "Volumen"
        ],
        "correctAnswer": "Contraste",
        "explanation": "Aumentar el contraste entre texto y fondo facilita distinguir las letras.",
        "stability": "STABLE",
        "source": null,
        "provenance": "source_pdf_corrected"
      },
      {
        "id": "ART6-126",
        "number": 126,
        "topic": "Arte universal",
        "concept": "autor_mona_lisa",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Quién pintó *La Mona Lisa*?",
        "options": [
          "Pablo Picasso",
          "Leonardo da Vinci",
          "Claude Monet",
          "Miguel Ángel"
        ],
        "correctAnswer": "Leonardo da Vinci",
        "explanation": "Leonardo da Vinci pintó *La Mona Lisa*.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-127",
        "number": 127,
        "topic": "Arte público — TRUE/FALSE",
        "concept": "mural_espacio_publico",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Un mural puede realizarse sobre una pared exterior.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Los murales pueden ocupar muros interiores o exteriores.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-128",
        "number": 128,
        "topic": "Arte universal",
        "concept": "autor_noche_estrellada",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Quién pintó *La noche estrellada*?",
        "options": [
          "Claude Monet",
          "Pablo Picasso",
          "Salvador Dalí",
          "Vincent van Gogh"
        ],
        "correctAnswer": "Vincent van Gogh",
        "explanation": "Vincent van Gogh pintó *La noche estrellada* en 1889.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-129",
        "number": 129,
        "topic": "Arte colombiano",
        "concept": "estilo_visual_botero",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué rasgo visual se asocia especialmente con muchas obras de Fernando Botero?",
        "options": [
          "Figuras voluminosas",
          "Perspectiva geométrica",
          "Pincelada impresionista",
          "Formas cubistas fragmentadas"
        ],
        "correctAnswer": "Figuras voluminosas",
        "explanation": "Botero desarrolló un estilo reconocible por sus volúmenes amplios.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-130",
        "number": 130,
        "topic": "Patrimonio colombiano",
        "concept": "fortificaciones_cartagena",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué rasgo de Cartagena destaca en su centro histórico?",
        "options": [
          "Canales prehispánicos",
          "Templos de madera",
          "Fortificaciones coloniales",
          "Murales rupestres"
        ],
        "correctAnswer": "Fortificaciones coloniales",
        "explanation": "Las murallas y fortificaciones forman parte destacada del patrimonio arquitectónico de Cartagena.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-131",
        "number": 131,
        "topic": "Composición visual",
        "concept": "espacio_negativo_aislamiento",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una ilustración deja amplio espacio vacío alrededor de una figura pequeña. ¿Qué efecto puede producir?",
        "options": [
          "Dinamismo",
          "Equilibrio",
          "Profundidad",
          "Aislamiento visual"
        ],
        "correctAnswer": "Aislamiento visual",
        "explanation": "El espacio vacío puede hacer que una figura parezca aislada o atraer la atención hacia ella.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-132",
        "number": 132,
        "topic": "Historieta",
        "concept": "secuencia_visual_narrativa",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una historieta, varias viñetas ordenadas muestran una acción sin texto. ¿Qué comunican principalmente?",
        "options": [
          "Una escala cromática",
          "Una secuencia narrativa",
          "Una ficha técnica",
          "Una composición simétrica"
        ],
        "correctAnswer": "Una secuencia narrativa",
        "explanation": "La sucesión de imágenes permite representar acciones y contar una historia visualmente.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-133",
        "number": 133,
        "topic": "Lectura de imágenes",
        "concept": "escala_relativa_en_composicion",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un personaje aparece diminuto frente a un edificio enorme. ¿Qué recurso visual cambia entre ambos?",
        "options": [
          "Escala",
          "Textura",
          "Simetría",
          "Ritmo"
        ],
        "correctAnswer": "Escala",
        "explanation": "El tamaño relativo de los elementos corresponde a la escala y puede crear una sensación de pequeñez frente al entorno.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-134",
        "number": 134,
        "topic": "Arte universal — TRUE/FALSE",
        "concept": "david_escultura",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El *David* de Miguel Ángel es una escultura.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Miguel Ángel realizó el *David* como una escultura de mármol.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-135",
        "number": 135,
        "topic": "Cine — TRUE/FALSE",
        "concept": "lenguajes_del_cine",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Una película puede combinar imágenes, sonido y actuación.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El cine integra recursos visuales, sonoros y escénicos.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-136",
        "number": 136,
        "topic": "Cine",
        "concept": "musica_creacion_suspenso",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Antes de mostrar un peligro, una película aumenta gradualmente la intensidad de la música. ¿Qué busca crear?",
        "options": [
          "Simetría",
          "Perspectiva",
          "Suspenso",
          "Proporción"
        ],
        "correctAnswer": "Suspenso",
        "explanation": "La música puede anticipar un riesgo y aumentar la tensión de una escena.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-137",
        "number": 137,
        "topic": "Fotografía y cine",
        "concept": "encuadre_reaccion",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una escena muestra solo los ojos de un personaje para destacar su reacción. ¿Qué decisión visual determina ese recorte?",
        "options": [
          "Encuadre",
          "Vestuario",
          "Escenografía",
          "Coreografía"
        ],
        "correctAnswer": "Encuadre",
        "explanation": "El encuadre decide qué parte de la escena aparece en la imagen.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-138",
        "number": 138,
        "topic": "Creación digital",
        "concept": "atribucion_autoria_imagen",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Al incluir en un collage una fotografía ajena, ¿qué práctica reconoce mejor la autoría?",
        "options": [
          "Cambiar el tamaño",
          "Añadir un filtro",
          "Recortar el fondo",
          "Atribuir la fuente"
        ],
        "correctAnswer": "Atribuir la fuente",
        "explanation": "Atribuir la fuente reconoce quién creó la imagen utilizada.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-139",
        "number": 139,
        "topic": "Cultura visual digital",
        "concept": "contexto_meme",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un meme reutiliza una imagen conocida para comentar una situación nueva. ¿Qué influye más en su nuevo sentido?",
        "options": [
          "La resolución",
          "El contexto",
          "El formato",
          "El tamaño"
        ],
        "correctAnswer": "El contexto",
        "explanation": "El contexto nuevo modifica cómo se interpreta una imagen reutilizada.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-140",
        "number": 140,
        "topic": "Arte colombiano — TRUE/FALSE",
        "concept": "medios_artistico_botero",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Fernando Botero trabajó tanto en pintura como en escultura.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Su producción artística incluye obras pictóricas y escultóricas.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-141",
        "number": 141,
        "topic": "Patrimonio",
        "concept": "procedencia_piezas_museo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué dato permite rastrear de dónde provino una pieza de museo?",
        "options": [
          "Su técnica",
          "Su tamaño",
          "Su procedencia",
          "Su color"
        ],
        "correctAnswer": "Su procedencia",
        "explanation": "La procedencia registra el origen y la trayectoria conocida de una pieza.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-142",
        "number": 142,
        "topic": "Lectura de imágenes",
        "concept": "direccion_luz_sombras",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En una pintura, las sombras de varios objetos apuntan en la misma dirección. ¿Qué puede inferirse?",
        "options": [
          "La dirección de la luz",
          "La edad de los objetos",
          "El material del marco",
          "La hora exacta del día"
        ],
        "correctAnswer": "La dirección de la luz",
        "explanation": "La dirección de las sombras aporta pistas sobre la dirección de la fuente de luz.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-143",
        "number": 143,
        "topic": "Teatro — TRUE/FALSE",
        "concept": "escenografia_vs_dialogo",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En una obra teatral, la escenografía contiene las palabras que dicen los personajes.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La escenografía representa el espacio; las palabras de los personajes forman parte del diálogo.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-144",
        "number": 144,
        "topic": "Diversidad cultural",
        "concept": "diversidad_en_relatos_tradicionales",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos comunidades representan un relato tradicional con músicas y vestuarios distintos. ¿Qué muestra principalmente?",
        "options": [
          "Error de representación",
          "Pérdida de la historia",
          "Copia exacta",
          "Diversidad cultural"
        ],
        "correctAnswer": "Diversidad cultural",
        "explanation": "Una misma historia puede expresarse de maneras diferentes según cada contexto cultural.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-145",
        "number": 145,
        "topic": "Museos — TRUE/FALSE",
        "concept": "funciones_museo",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Un museo puede documentar una pieza además de exhibirla.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Los museos pueden conservar, documentar, investigar y exhibir sus colecciones.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-146",
        "number": 146,
        "topic": "Cine — TRUE/FALSE",
        "concept": "comunicacion_no_verbal_cine",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Una película puede comunicar una acción sin usar diálogo hablado.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las imágenes, los gestos y los sonidos también comunican acciones e ideas.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-147",
        "number": 147,
        "topic": "Símbolos visuales — TRUE/FALSE",
        "concept": "simbolo_visual",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Un símbolo visual puede representar una idea sin escribirla directamente.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Un símbolo comunica una idea mediante una imagen reconocible.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-148",
        "number": 148,
        "topic": "Cultura artística — TRUE/FALSE",
        "concept": "reconocimiento_artistas_colombianos",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una obra reconocida puede haber sido creada por un artista colombiano.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El reconocimiento artístico no depende de que el autor sea extranjero.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-149",
        "number": 149,
        "topic": "Interpretación artística — TRUE/FALSE",
        "concept": "interpretacion_multifactorial_obra",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Conocer quién creó una obra basta para comprender por completo su significado.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "También pueden aportar significado la época, el contexto, los recursos visuales y distintas interpretaciones.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      },
      {
        "id": "ART6-150",
        "number": 150,
        "topic": "Comparación de objetos",
        "concept": "comparacion_material_funcion",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un museo compara dos objetos semejantes de épocas distintas. ¿Qué pareja de aspectos ayuda más a reconocer cambios en su uso y fabricación?",
        "options": [
          "Precio y ubicación",
          "Material y función",
          "Peso y vitrina",
          "Altura y color"
        ],
        "correctAnswer": "Material y función",
        "explanation": "Comparar materiales y funciones ayuda a reconocer cómo cambiaron la fabricación y el uso de objetos a través del tiempo.",
        "stability": "STABLE",
        "source": null,
        "provenance": "user_supplied_corrected_batch"
      }
    ]
  },
  {
    "catalogId": "edusyn-historia-grade-6-v1",
    "title": "Historia · 6.º",
    "grade": 6,
    "subjectArea": "Duelos",
    "category": "Historia",
    "version": "1.0",
    "availability": "institution-opt-in",
    "editorialStatus": "ready-for-import",
    "audit": {
      "questions": 150,
      "multipleChoice": 120,
      "trueFalse": 30,
      "difficulty": {
        "basic": 50,
        "intermediate": 70,
        "application": 30
      },
      "answerPositions": {
        "A": 30,
        "B": 30,
        "C": 30,
        "D": 30
      },
      "conceptsPresent": 150,
      "conceptsMissing": 0
    },
    "questions": [
      {
        "id": "HIS6-001",
        "number": 1,
        "topic": "Fuentes históricas",
        "concept": "fuente_material",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En una excavación encuentran un fragmento de vasija antigua. ¿Qué tipo de fuente es?",
        "options": [
          "Material  ",
          "Oral  ",
          "Audiovisual  ",
          "Cartográfica"
        ],
        "correctAnswer": "Material  ",
        "explanation": "Los objetos y restos físicos son fuentes materiales para estudiar el pasado.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-002",
        "number": 2,
        "topic": "Civilizaciones antiguas",
        "concept": "rio_nilo_egipto",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué río fue central para el desarrollo del antiguo Egipto?",
        "options": [
          "Indo  ",
          "Nilo  ",
          "Éufrates  ",
          "Tigris"
        ],
        "correctAnswer": "Nilo  ",
        "explanation": "El Nilo aportó agua, transporte y tierras fértiles a las comunidades egipcias.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-003",
        "number": 3,
        "topic": "Mesopotamia",
        "concept": "escritura_cuneiforme",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué sistema de escritura se asocia con la antigua Mesopotamia?",
        "options": [
          "Jeroglífica  ",
          "Latina  ",
          "Cuneiforme  ",
          "Griega"
        ],
        "correctAnswer": "Cuneiforme  ",
        "explanation": "Diversas sociedades mesopotámicas usaron la escritura cuneiforme.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-004",
        "number": 4,
        "topic": "Pueblos indígenas de Colombia",
        "concept": "territorio_muisca",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué zona vivían principalmente los muiscas?",
        "options": [
          "Sierra Nevada de Santa Marta  ",
          "Llanos Orientales  ",
          "Amazonía  ",
          "Altiplano Cundiboyacense"
        ],
        "correctAnswer": "Altiplano Cundiboyacense",
        "explanation": "Los muiscas habitaron el altiplano de la cordillera Oriental, en el actual centro de Colombia.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-005",
        "number": 5,
        "topic": "Prehistoria",
        "concept": "subsistencia_cazadora_recolectora",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Un grupo se desplaza para seguir animales y recolectar plantas silvestres. ¿Qué forma de vida describe mejor?",
        "options": [
          "Caza y recolección  ",
          "Agricultura de regadío  ",
          "Comercio urbano  ",
          "Trabajo fabril"
        ],
        "correctAnswer": "Caza y recolección  ",
        "explanation": "Los grupos cazadores-recolectores obtenían alimentos de animales y plantas disponibles en su entorno.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-006",
        "number": 6,
        "topic": "Independencia de Colombia",
        "concept": "junta_santafe_1810",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué se estableció en Santafé durante los sucesos del 20 de julio de 1810?",
        "options": [
          "La República de Colombia  ",
          "Una Junta Suprema de Gobierno  ",
          "La Constitución de 1991  ",
          "El Virreinato de la Nueva Granada"
        ],
        "correctAnswer": "Una Junta Suprema de Gobierno  ",
        "explanation": "Los sucesos llevaron a establecer una junta de gobierno; no proclamaron por sí solos la independencia definitiva.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-007",
        "number": 7,
        "topic": "Tiempo histórico",
        "concept": "orden_cronologico_antes_de_cristo",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál de estas fechas ocurrió primero?",
        "options": [
          "120 a. C.  ",
          "30 d. C.  ",
          "300 a. C.  ",
          "1810 d. C."
        ],
        "correctAnswer": "300 a. C.  ",
        "explanation": "En las fechas antes de nuestra era, un número mayor indica un momento más antiguo.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-008",
        "number": 8,
        "topic": "TRUE/FALSE",
        "concept": "variedad_de_fuentes",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Para estudiar el pasado basta con consultar documentos escritos.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "También aportan información los objetos, las imágenes, los relatos orales y otros restos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-009",
        "number": 9,
        "topic": "Fuentes históricas",
        "concept": "fuente_primaria",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una carta escrita durante un acontecimiento es, para quien la estudia, una fuente:",
        "options": [
          "Secundaria  ",
          "Cartográfica  ",
          "Arqueológica  ",
          "Primaria"
        ],
        "correctAnswer": "Primaria",
        "explanation": "Una fuente producida en la época estudiada puede ofrecer un testimonio directo, aunque refleje el punto de vista de su autor.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-010",
        "number": 10,
        "topic": "Arqueología",
        "concept": "contexto_arqueologico",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué importa registrar la capa del suelo donde aparece un objeto?",
        "options": [
          "Ayuda a interpretar su contexto  ",
          "Permite estimar su precio  ",
          "Identifica automáticamente a su dueño  ",
          "Prueba quién lo fabricó"
        ],
        "correctAnswer": "Ayuda a interpretar su contexto  ",
        "explanation": "La ubicación y relación con otros restos ayudan a interpretar cuándo y cómo se usó un objeto.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-011",
        "number": 11,
        "topic": "Agricultura antigua",
        "concept": "rios_y_agricultura",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Tras una crecida, el Nilo deja limo en sus orillas. ¿Qué beneficio podía aportar a los cultivos?",
        "options": [
          "Reducir la luz que reciben las plantas  ",
          "Aportar nutrientes al suelo  ",
          "Volver saladas todas las parcelas  ",
          "Retirar las semillas de los campos"
        ],
        "correctAnswer": "Aportar nutrientes al suelo  ",
        "explanation": "El agua y los suelos renovados por los ríos favorecían los cultivos, aunque las crecidas también podían causar daños.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-012",
        "number": 12,
        "topic": "Organización social",
        "concept": "coordinacion_riego",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un canal abastece varias parcelas durante una estación seca. ¿Qué acuerdo ayuda más a distribuir el agua?",
        "options": [
          "Cambiar las fronteras del territorio  ",
          "Cerrar el canal a todas las parcelas  ",
          "Asignar turnos de riego  ",
          "Abandonar los cultivos cercanos"
        ],
        "correctAnswer": "Asignar turnos de riego  ",
        "explanation": "Mantener canales compartidos requiere organizar tareas y distribuir el agua.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-013",
        "number": 13,
        "topic": "Intercambio cultural",
        "concept": "evidencia_intercambio",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una zona interior encuentran conchas que proceden de una costa lejana. ¿Qué explicación es más probable?",
        "options": [
          "Las arrastró un río desde la montaña  ",
          "Se formaron dentro de una vivienda  ",
          "Se produjeron con arcilla local  ",
          "Llegaron mediante contacto entre regiones"
        ],
        "correctAnswer": "Llegaron mediante contacto entre regiones",
        "explanation": "Un objeto de origen distante puede indicar intercambio, viajes o redes de contacto.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-014",
        "number": 14,
        "topic": "Conquista y perspectivas",
        "concept": "perspectiva_de_cronicas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Al leer una crónica escrita por un conquistador, ¿qué conviene tener en cuenta?",
        "options": [
          "El punto de vista de su autor  ",
          "Que describe a todos por igual  ",
          "Que no contiene opiniones  ",
          "Que fue escrita por testigos de ambos lados"
        ],
        "correctAnswer": "El punto de vista de su autor  ",
        "explanation": "El lugar y los intereses del autor influyen en lo que registra y en cómo lo interpreta.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-015",
        "number": 15,
        "topic": "TRUE/FALSE",
        "concept": "perspectivas_de_fuentes",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Dos fuentes pueden contar de manera distinta un mismo acontecimiento.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las personas pueden observar y narrar un hecho desde posiciones e intereses diferentes.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-016",
        "number": 16,
        "topic": "TRUE/FALSE",
        "concept": "memoria_oral",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Los relatos orales pueden conservar recuerdos y conocimientos de una comunidad.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La transmisión oral también permite preservar y compartir memoria histórica.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-017",
        "number": 17,
        "topic": "Historia colonial",
        "concept": "registro_colonial_tributos",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué fuente sería más directa para investigar cómo se organizaban los tributos durante el periodo colonial?",
        "options": [
          "Un diario de navegación colonial  ",
          "Un catálogo moderno de cerámica  ",
          "Un registro colonial de tributos  ",
          "Un plano actual de la ciudad"
        ],
        "correctAnswer": "Un registro colonial de tributos  ",
        "explanation": "Un registro de la época puede documentar tributos, aunque debe leerse considerando quién lo produjo y para qué.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-018",
        "number": 18,
        "topic": "Independencia de Colombia",
        "concept": "batalla_de_boyaca",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué batalla de 1819 fue decisiva para la campaña independentista en la Nueva Granada?",
        "options": [
          "Batalla de Palonegro  ",
          "Batalla de Ayacucho  ",
          "Batalla de Boyacá  ",
          "Batalla de Carabobo"
        ],
        "correctAnswer": "Batalla de Boyacá  ",
        "explanation": "La victoria patriota en Boyacá, en 1819, fue decisiva en la campaña de independencia de la Nueva Granada.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-019",
        "number": 19,
        "topic": "Leyes antiguas",
        "concept": "leyes_como_fuente_social",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una estela antigua enumera normas y sanciones. ¿Qué permite estudiar principalmente?",
        "options": [
          "Las normas sociales  ",
          "Las técnicas de cultivo  ",
          "Las rutas comerciales  ",
          "Las creencias religiosas"
        ],
        "correctAnswer": "Las creencias religiosas",
        "explanation": "Las leyes escritas ofrecen evidencia sobre normas, autoridad y conflictos reconocidos por una sociedad.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-020",
        "number": 20,
        "topic": "Escritura e historia",
        "concept": "escritura_administrativa",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Para qué servían algunos de los primeros registros escritos en Mesopotamia?",
        "options": [
          "Relatar solo leyendas  ",
          "Registrar bienes e intercambios  ",
          "Dibujar mapas de relieve  ",
          "Describir paisajes lejanos"
        ],
        "correctAnswer": "Registrar bienes e intercambios  ",
        "explanation": "La escritura también apoyó tareas administrativas, como registrar productos e intercambios.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-021",
        "number": 21,
        "topic": "Comparación de fuentes",
        "concept": "contraste_de_testimonios",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos cartas de la misma época describen una protesta de forma opuesta. ¿Qué ayuda más a evaluar sus versiones?",
        "options": [
          "Preferir la carta con más detalles  ",
          "Comparar autoría, propósito y otras evidencias  ",
          "Elegir la versión que aparece primero  ",
          "Dar el mismo peso a cada frase"
        ],
        "correctAnswer": "Comparar autoría, propósito y otras evidencias  ",
        "explanation": "Comparar quién escribió, para quién y con qué propósito ayuda a contrastar los relatos con otras evidencias.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-022",
        "number": 22,
        "topic": "TRUE/FALSE",
        "concept": "mapas_como_representaciones",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Un mapa histórico muestra una representación neutral que no depende de quién lo hizo ni de cuándo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La fecha, el propósito y las decisiones de quien elaboró el mapa influyen en lo que muestra.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-023",
        "number": 23,
        "topic": "Interpretación arqueológica",
        "concept": "objetos_y_actividad_domestica",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Encuentran muchas vasijas de cocina dentro de una antigua vivienda. ¿Qué inferencia está mejor apoyada?",
        "options": [
          "Allí se preparaban o guardaban alimentos  ",
          "Allí se realizaban todas las ceremonias  ",
          "Todas las familias tenían idénticas rutinas  ",
          "Allí nunca se recibían visitantes"
        ],
        "correctAnswer": "Allí se preparaban o guardaban alimentos  ",
        "explanation": "El tipo y el lugar de los objetos respaldan una posible función doméstica, pero no revelan por sí solos toda la vida de sus habitantes.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-024",
        "number": 24,
        "topic": "Excedentes y organización",
        "concept": "almacenamiento_de_excedentes",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una comunidad almacena parte de la cosecha en un depósito común. ¿Qué necesidad pudo impulsar esta práctica?",
        "options": [
          "Evitar compartir tareas  ",
          "Impedir el uso de herramientas  ",
          "Separar a las familias en aldeas  ",
          "Administrar reservas para otros momentos"
        ],
        "correctAnswer": "Administrar reservas para otros momentos",
        "explanation": "Guardar excedentes permite disponer de alimentos después de la cosecha o distribuirlos según las necesidades.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-025",
        "number": 25,
        "topic": "TRUE/FALSE",
        "concept": "historia_sin_escritura",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si una sociedad no dejó textos escritos, no es posible estudiar su historia.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La arqueología, los relatos orales y otras evidencias permiten investigar sociedades sin registros escritos propios.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-026",
        "number": 26,
        "topic": "Arqueología",
        "concept": "datacion_radiocarbono",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué método puede estimar la antigüedad de restos orgánicos mediante carbono-14?",
        "options": [
          "Análisis de cerámica  ",
          "Excavación estratigráfica  ",
          "Comparación oral  ",
          "Datación por radiocarbono"
        ],
        "correctAnswer": "Datación por radiocarbono",
        "explanation": "La datación por radiocarbono mide el carbono-14 restante en materiales orgánicos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-027",
        "number": 27,
        "topic": "Antiguo Egipto",
        "concept": "funcion_piramides_egipcias",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Para qué se construyeron muchas pirámides egipcias?",
        "options": [
          "Como mercados  ",
          "Como tumbas reales  ",
          "Como canales de riego  ",
          "Como murallas fronterizas"
        ],
        "correctAnswer": "Como tumbas reales  ",
        "explanation": "Varias pirámides fueron monumentos funerarios vinculados con faraones.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-028",
        "number": 28,
        "topic": "Antigua Grecia",
        "concept": "polis_griega",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué era una polis?",
        "options": [
          "Una provincia imperial  ",
          "Una aldea estacional  ",
          "Una ciudad-Estado  ",
          "Una colonia militar"
        ],
        "correctAnswer": "Una ciudad-Estado  ",
        "explanation": "Una polis era una comunidad política organizada alrededor de una ciudad y su territorio.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-029",
        "number": 29,
        "topic": "Antigua Roma",
        "concept": "funcion_acueducto_romano",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué transportaba un acueducto romano hacia una ciudad?",
        "options": [
          "Tropas  ",
          "Cereales  ",
          "Mensajes  ",
          "Agua"
        ],
        "correctAnswer": "Agua",
        "explanation": "Los acueductos conducían agua desde fuentes hasta poblaciones y otras instalaciones.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-030",
        "number": 30,
        "topic": "Pueblos indígenas de Colombia",
        "concept": "territorio_tairona",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué región se desarrolló la sociedad tairona?",
        "options": [
          "Sierra Nevada de Santa Marta  ",
          "Altiplano Cundiboyacense  ",
          "Llanos Orientales  ",
          "Amazonía occidental"
        ],
        "correctAnswer": "Sierra Nevada de Santa Marta  ",
        "explanation": "Las comunidades taironas habitaron la Sierra Nevada de Santa Marta, desde zonas costeras hasta sectores montañosos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-031",
        "number": 31,
        "topic": "Antigua Grecia",
        "concept": "limites_ciudadania_ateniense",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En la antigua Atenas, todas las personas residentes podían participar como ciudadanos en la asamblea.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La ciudadanía política ateniense excluía a grupos como mujeres, personas esclavizadas y extranjeros residentes.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-032",
        "number": 32,
        "topic": "Civilizaciones americanas",
        "concept": "copan_maya",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué civilización construyó la ciudad de Copán?",
        "options": [
          "Inca  ",
          "Maya  ",
          "Muisca  ",
          "Tairona"
        ],
        "correctAnswer": "Maya  ",
        "explanation": "Copán fue una importante ciudad de la civilización maya.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-033",
        "number": 33,
        "topic": "Civilización inca",
        "concept": "quipu_registro_inca",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué eran los quipus?",
        "options": [
          "Templos de piedra  ",
          "Canales agrícolas  ",
          "Cordones con nudos para registrar información  ",
          "Embarcaciones de pesca"
        ],
        "correctAnswer": "Cordones con nudos para registrar información  ",
        "explanation": "Los incas usaron quipus, conjuntos de cordones y nudos, para registrar información numérica y administrativa.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-034",
        "number": 34,
        "topic": "Agricultura antigua",
        "concept": "agricultura_y_asentamiento",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Cuando la agricultura se volvió importante para una comunidad, ¿qué cambio podía favorecer?",
        "options": [
          "Asentamientos más permanentes  ",
          "El abandono de toda herramienta  ",
          "La desaparición del intercambio  ",
          "La migración diaria de todas las familias"
        ],
        "correctAnswer": "Asentamientos más permanentes  ",
        "explanation": "Cultivar ciertos terrenos podía animar a algunas comunidades a permanecer cerca de sus campos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-035",
        "number": 35,
        "topic": "Civilización maya",
        "concept": "ciudades_estado_mayas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se organizaban políticamente muchas ciudades mayas del periodo clásico?",
        "options": [
          "Como una sola capital que gobernaba todo el continente  ",
          "Como ciudades-Estado independientes y relacionadas  ",
          "Como provincias del Imperio romano  ",
          "Como campamentos sin centros urbanos"
        ],
        "correctAnswer": "Como ciudades-Estado independientes y relacionadas  ",
        "explanation": "Muchas ciudades mayas tuvieron gobernantes propios y mantuvieron relaciones entre sí, incluidas alianzas y conflictos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-036",
        "number": 36,
        "topic": "Imperio inca",
        "concept": "red_vial_inca",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función cumplía principalmente el Qhapaq Ñan, la red vial andina?",
        "options": [
          "Separar a las comunidades de montaña  ",
          "Sustituir los centros agrícolas  ",
          "Conectar poblaciones y centros del territorio  ",
          "Marcar únicamente fronteras costeras"
        ],
        "correctAnswer": "Conectar poblaciones y centros del territorio  ",
        "explanation": "La red conectaba asentamientos, centros administrativos, áreas productivas y lugares ceremoniales.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-037",
        "number": 37,
        "topic": "Intercambio muisca",
        "concept": "intercambio_muisca",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Los registros sobre los muiscas describen intercambios de sal, algodón y otros productos. ¿Qué actividad muestran?",
        "options": [
          "Recaudo de impuestos coloniales  ",
          "Conquista de nuevos territorios  ",
          "Producción fabril  ",
          "Intercambio entre comunidades"
        ],
        "correctAnswer": "Intercambio entre comunidades",
        "explanation": "El intercambio permitía obtener productos de distintas zonas ecológicas.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-038",
        "number": 38,
        "topic": "Agricultura tairona",
        "concept": "terrazas_tairona",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Las terrazas de cultivo taironas fueron útiles principalmente para trabajar:",
        "options": [
          "Laderas montañosas  ",
          "Llanuras cubiertas de hielo  ",
          "Desiertos sin lluvias  ",
          "Islas sin suelo"
        ],
        "correctAnswer": "Laderas montañosas  ",
        "explanation": "Las terrazas escalonadas permitían cultivar en laderas de la Sierra Nevada.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-039",
        "number": 39,
        "topic": "Gobierno colonial",
        "concept": "cabildo_gobierno_local",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función tenía el cabildo en muchas ciudades coloniales hispanoamericanas?",
        "options": [
          "Dirigir una comunidad religiosa indígena  ",
          "Atender asuntos del gobierno local  ",
          "Administrar una ruta imperial asiática  ",
          "Organizar una compañía industrial"
        ],
        "correctAnswer": "Atender asuntos del gobierno local  ",
        "explanation": "El cabildo era una institución de gobierno municipal en las ciudades coloniales.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-040",
        "number": 40,
        "topic": "Historia afrocolombiana",
        "concept": "palenques_resistencia",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué nombre recibieron algunas comunidades fundadas por personas que escapaban de la esclavización?",
        "options": [
          "Encomiendas  ",
          "Virreinatos  ",
          "Palenques  ",
          "Audiencias"
        ],
        "correctAnswer": "Palenques  ",
        "explanation": "Los palenques fueron comunidades creadas por personas que resistieron la esclavización y buscaron vivir en libertad.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-041",
        "number": 41,
        "topic": "Sociedad colonial",
        "concept": "desigualdad_juridica_colonial",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En las sociedades coloniales, todas las personas tenían los mismos derechos y obligaciones.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Las normas coloniales establecían diferencias de condición jurídica y social.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-042",
        "number": 42,
        "topic": "Imprenta e historia",
        "concept": "reproduccion_de_textos_imprenta",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cambio facilitó la imprenta de tipos móviles en Europa?",
        "options": [
          "Hizo innecesaria la lectura  ",
          "Eliminó las lenguas locales  ",
          "Impidió copiar textos religiosos  ",
          "Permitió reproducir textos con mayor rapidez"
        ],
        "correctAnswer": "Permitió reproducir textos con mayor rapidez",
        "explanation": "La impresión permitió producir más copias de un texto que la copia manual.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-043",
        "number": 43,
        "topic": "Revolución haitiana",
        "concept": "independencia_haiti_1804",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ocurrió en Haití en 1804?",
        "options": [
          "Se proclamó su independencia de Francia  ",
          "Se fundó el Imperio inca  ",
          "Se creó la Junta de Santafé  ",
          "Se libró la batalla de Boyacá"
        ],
        "correctAnswer": "Se proclamó su independencia de Francia  ",
        "explanation": "Haití declaró su independencia en 1804 tras una revolución contra el dominio francés.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-044",
        "number": 44,
        "topic": "Revolución industrial",
        "concept": "mecanizacion_y_fabricas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cambio caracteriza a la Revolución industrial?",
        "options": [
          "El regreso general a la caza y la recolección  ",
          "El crecimiento de la producción con máquinas y fábricas  ",
          "El abandono de las ciudades  ",
          "La desaparición del comercio"
        ],
        "correctAnswer": "El crecimiento de la producción con máquinas y fábricas  ",
        "explanation": "La mecanización y el sistema fabril transformaron la producción y la vida de muchas sociedades.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-045",
        "number": 45,
        "topic": "Procesos históricos",
        "concept": "ritmos_historicos_regionales",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Los cambios históricos ocurrieron al mismo tiempo y de la misma manera en todas las regiones.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Un proceso puede avanzar en momentos y formas distintos según cada región y sociedad.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-046",
        "number": 46,
        "topic": "Interpretación de fuentes",
        "concept": "imagen_moneda_representacion_poder",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una moneda muestra al gobernante con una corona y rodeado de símbolos de victoria. ¿Qué permite afirmar con mayor seguridad?",
        "options": [
          "Cómo quería representarse su autoridad  ",
          "Que ganó todas las batallas  ",
          "Que todos sus habitantes lo apoyaban  ",
          "Que la imagen retrata su aspecto exacto"
        ],
        "correctAnswer": "Cómo quería representarse su autoridad  ",
        "explanation": "La moneda es evidencia de una representación oficial del poder, pero no prueba por sí sola que todos los hechos celebrados ocurrieran como se muestran.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-047",
        "number": 47,
        "topic": "Evidencia arqueológica",
        "concept": "inferencia_murallas_urbanas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En una antigua ciudad encuentran murallas alrededor de viviendas y depósitos. ¿Qué conclusión es más prudente?",
        "options": [
          "Nunca hubo conflictos en la región  ",
          "Todos sus habitantes eran soldados  ",
          "La ciudad pudo proteger espacios y bienes  ",
          "El lugar perteneció a un solo gobernante"
        ],
        "correctAnswer": "La ciudad pudo proteger espacios y bienes  ",
        "explanation": "Las murallas pueden apoyar una hipótesis de protección, pero no permiten concluir que toda la población fuera militar.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-048",
        "number": 48,
        "topic": "TRUE/FALSE",
        "concept": "alcance_inscripcion_politica",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Una inscripción que elogia a un gobernante demuestra, por sí sola, que todos los habitantes pensaban igual.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Una inscripción puede expresar la visión de quien la encargó; no representa automáticamente a toda la población.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-049",
        "number": 49,
        "topic": "Comparación de objetos",
        "concept": "comparacion_herramientas_arqueologicas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En dos asentamientos separados aparecen herramientas de piedra de formas parecidas. ¿Qué pregunta ayuda más a probar si hubo contacto entre ellos?",
        "options": [
          "¿Cuál herramienta pesa más?  ",
          "¿Qué color tiene cada piedra?  ",
          "¿Cuál asentamiento tiene hoy más habitantes?  ",
          "¿A qué periodos y materiales corresponden las herramientas?"
        ],
        "correctAnswer": "¿A qué periodos y materiales corresponden las herramientas?",
        "explanation": "Comparar datación, materiales y técnicas de fabricación permite evaluar si los objetos pudieron relacionarse.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-050",
        "number": 50,
        "topic": "TRUE/FALSE",
        "concept": "limites_inferencia_objetos",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Que dos sociedades usen objetos parecidos demuestra por sí solo que tuvieron el mismo gobierno.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La semejanza de objetos puede tener varias explicaciones y no prueba por sí sola una organización política común.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-051",
        "number": 51,
        "topic": "Fuentes históricas",
        "concept": "fuente_primaria_documento_legal",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué fuente primaria puede informar sobre una ley promulgada en el pasado?",
        "options": [
          "El texto original de la ley  ",
          "Una novela actual  ",
          "Un mapa turístico reciente  ",
          "Una reseña sin referencias"
        ],
        "correctAnswer": "El texto original de la ley  ",
        "explanation": "El texto original fue producido en el periodo estudiado y permite consultar directamente la norma.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-052",
        "number": 52,
        "topic": "Tiempo histórico",
        "concept": "funcion_linea_tiempo",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué instrumento representa acontecimientos en orden cronológico?",
        "options": [
          "Un plano urbano  ",
          "Una línea de tiempo  ",
          "Un censo  ",
          "Un árbol familiar"
        ],
        "correctAnswer": "Una línea de tiempo  ",
        "explanation": "Una línea de tiempo organiza acontecimientos según cuándo ocurrieron.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-053",
        "number": 53,
        "topic": "Civilizaciones antiguas",
        "concept": "rios_mesopotamia",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Entre qué dos ríos se desarrolló gran parte de Mesopotamia?",
        "options": [
          "Nilo y Congo  ",
          "Indo y Ganges  ",
          "Tigris y Éufrates  ",
          "Danubio y Rin"
        ],
        "correctAnswer": "Tigris y Éufrates  ",
        "explanation": "Mesopotamia se ubicó principalmente entre los ríos Tigris y Éufrates.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-054",
        "number": 54,
        "topic": "Historia de Colombia",
        "concept": "liderazgo_campana_libertadora_1819",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Quién lideró la campaña libertadora que culminó en la batalla de Boyacá?",
        "options": [
          "Antonio Nariño  ",
          "Francisco de Paula Santander  ",
          "José María Carbonell  ",
          "Simón Bolívar"
        ],
        "correctAnswer": "Simón Bolívar",
        "explanation": "Simón Bolívar dirigió la campaña libertadora de 1819; Santander tuvo un papel destacado en su organización militar.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-055",
        "number": 55,
        "topic": "Historia",
        "concept": "definicion_fuente_secundaria",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Una fuente secundaria interpreta o analiza fuentes y acontecimientos del pasado.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las fuentes secundarias se elaboran posteriormente para explicar o interpretar el pasado.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-056",
        "number": 56,
        "topic": "Sociedades antiguas",
        "concept": "definicion_ganaderia",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué actividad consiste en criar animales domésticos para obtener recursos?",
        "options": [
          "Ganadería  ",
          "Alfarería  ",
          "Navegación  ",
          "Metalurgia"
        ],
        "correctAnswer": "Ganadería  ",
        "explanation": "La ganadería implica la cría y cuidado de animales domesticados.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-057",
        "number": 57,
        "topic": "Historia de Colombia",
        "concept": "fecha_batalla_boyaca",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué año ocurrió la batalla de Boyacá?",
        "options": [
          "1810  ",
          "1819  ",
          "1821  ",
          "1830"
        ],
        "correctAnswer": "1819  ",
        "explanation": "La batalla del puente de Boyacá ocurrió el 7 de agosto de 1819.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-058",
        "number": 58,
        "topic": "Imperios antiguos",
        "concept": "titulo_gobernante_egipcio",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué nombre recibía el gobernante del antiguo Egipto?",
        "options": [
          "Cónsul  ",
          "Basileus  ",
          "Faraón  ",
          "Sátrapa"
        ],
        "correctAnswer": "Faraón  ",
        "explanation": "Faraón es el título con el que se conoce al gobernante del antiguo Egipto.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-059",
        "number": 59,
        "topic": "Historia",
        "concept": "arqueologia_evidencia_material",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La arqueología estudia sociedades del pasado, entre otras evidencias, mediante objetos y restos materiales.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Los objetos, construcciones y restos ofrecen evidencia para investigar formas de vida pasadas.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-060",
        "number": 60,
        "topic": "Edad Media",
        "concept": "influencia_iglesia_europa_medieval",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué institución tuvo gran influencia religiosa y cultural en la Europa medieval?",
        "options": [
          "Los gremios artesanales  ",
          "Los tribunales señoriales  ",
          "Las cancillerías reales  ",
          "La Iglesia cristiana"
        ],
        "correctAnswer": "La Iglesia cristiana",
        "explanation": "La Iglesia cristiana fue una institución central en numerosos aspectos de la vida europea medieval.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-061",
        "number": 61,
        "topic": "Fuentes históricas",
        "concept": "contraste_perspectivas_fuentes",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un diario personal y un informe oficial describen la misma protesta de manera distinta. ¿Qué conviene hacer?",
        "options": [
          "Elegir el texto más largo  ",
          "Suponer que ambos son inventados  ",
          "Aceptar solo el documento oficial  ",
          "Comparar quién los produjo y con qué propósito"
        ],
        "correctAnswer": "Comparar quién los produjo y con qué propósito",
        "explanation": "Autoría, propósito y contexto ayudan a analizar por qué las fuentes presentan perspectivas diferentes.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-062",
        "number": 62,
        "topic": "Tiempo histórico",
        "concept": "funcion_y_limites_periodizacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué se usan periodizaciones para estudiar la historia?",
        "options": [
          "Para afirmar que todos vivieron igual  ",
          "Para borrar diferencias regionales  ",
          "Para organizar procesos largos y facilitar su estudio  ",
          "Para reemplazar las evidencias"
        ],
        "correctAnswer": "Para organizar procesos largos y facilitar su estudio  ",
        "explanation": "Las periodizaciones son herramientas para organizar el estudio; sus límites no significan que la vida cambiara de golpe.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-063",
        "number": 63,
        "topic": "Civilizaciones fluviales",
        "concept": "crecidas_y_suelos_fertiles",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo podían las inundaciones regulares de algunos ríos favorecer la agricultura antigua?",
        "options": [
          "Dejaban sedimentos que enriquecían los suelos  ",
          "Eliminaban toda necesidad de sembrar  ",
          "Convertían cada valle en desierto  ",
          "Impedían asentarse cerca del agua"
        ],
        "correctAnswer": "Dejaban sedimentos que enriquecían los suelos  ",
        "explanation": "En ciertos valles, las crecidas depositaban sedimentos fértiles, aunque también podían causar daños.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-064",
        "number": 64,
        "topic": "Historia de Colombia",
        "concept": "criollos_y_peninsulares",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué diferencia principal había entre criollos y peninsulares en la sociedad colonial?",
        "options": [
          "Los criollos nacían en España  ",
          "Los peninsulares eran pueblos indígenas  ",
          "Los criollos solo vivían en África  ",
          "Los criollos descendían de españoles y nacían en América"
        ],
        "correctAnswer": "Los criollos descendían de españoles y nacían en América",
        "explanation": "En el uso colonial, criollos eran descendientes de españoles nacidos en América; peninsulares habían nacido en la península ibérica.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-065",
        "number": 65,
        "topic": "Historia",
        "concept": "proceso_independencia_y_20_julio",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "La toma de Santafé del 20 de julio de 1810 produjo de inmediato la independencia completa de todos los territorios que hoy son Colombia.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "El 20 de julio inició una etapa de juntas y cambios políticos; la independencia fue un proceso prolongado.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-066",
        "number": 66,
        "topic": "Historia global",
        "concept": "expansion_circuitos_comerciales_atlanticos",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué consecuencia tuvo para Europa la llegada de productos americanos después de 1492?",
        "options": [
          "Desapareció el comercio marítimo  ",
          "Se ampliaron intercambios y circuitos comerciales  ",
          "Terminó toda migración entre continentes  ",
          "Se abandonó la navegación oceánica"
        ],
        "correctAnswer": "Se ampliaron intercambios y circuitos comerciales  ",
        "explanation": "La conquista y colonización conectaron circuitos comerciales entre continentes, con impactos desiguales y violentos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-067",
        "number": 67,
        "topic": "Historia de Colombia",
        "concept": "importancia_portuaria_cartagena",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué la ubicación de Cartagena fue importante durante el periodo colonial?",
        "options": [
          "Era un puerto estratégico del Caribe  ",
          "Estaba junto al océano Pacífico  ",
          "Controlaba el paso entre Asia y Europa por tierra  ",
          "No tenía conexión con rutas marítimas"
        ],
        "correctAnswer": "Era un puerto estratégico del Caribe  ",
        "explanation": "Su puerto caribeño la convirtió en un punto estratégico para las rutas y defensas del imperio español.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-068",
        "number": 68,
        "topic": "Historia global",
        "concept": "recuperacion_tradicion_clasica_renacimiento",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cambio se asocia con el Renacimiento europeo?",
        "options": [
          "El abandono de las artes  ",
          "El fin de todo estudio clásico  ",
          "Un renovado interés por ideas y obras de la Antigüedad  ",
          "La desaparición de las ciudades"
        ],
        "correctAnswer": "Un renovado interés por ideas y obras de la Antigüedad  ",
        "explanation": "Parte del Renacimiento recuperó y reinterpretó tradiciones clásicas en el arte y el pensamiento.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-069",
        "number": 69,
        "topic": "Historia",
        "concept": "mapas_como_fuente_y_perspectiva",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Un mapa antiguo puede mostrar tanto información geográfica como las prioridades de quienes lo elaboraron.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La selección, escala y rotulación de un mapa reflejan conocimientos y propósitos de su época.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-070",
        "number": 70,
        "topic": "Sociedades antiguas",
        "concept": "escritura_y_administracion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué podía facilitar la invención de sistemas de escritura en algunos estados antiguos?",
        "options": [
          "La desaparición de la memoria oral  ",
          "El registro de tributos y acuerdos  ",
          "La igualdad política automática  ",
          "El fin de la administración"
        ],
        "correctAnswer": "El registro de tributos y acuerdos  ",
        "explanation": "La escritura permitió registrar información administrativa, aunque su uso no implicó igualdad ni alfabetización general.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-071",
        "number": 71,
        "topic": "Historia global",
        "concept": "cuestionamiento_absolutismo_frances",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cambio político se relaciona con la Revolución francesa de 1789?",
        "options": [
          "El fortalecimiento de los privilegios feudales  ",
          "La restauración del Imperio romano  ",
          "La abolición mundial de las monarquías  ",
          "El cuestionamiento de la monarquía absoluta y los privilegios"
        ],
        "correctAnswer": "El cuestionamiento de la monarquía absoluta y los privilegios",
        "explanation": "La revolución cuestionó el absolutismo y los privilegios estamentales en Francia, aunque sus efectos fueron complejos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-072",
        "number": 72,
        "topic": "Interpretar cronologías",
        "concept": "inferencia_causal_desde_cronologia",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una cronología ubica primero una sequía, luego escasez de alimentos y después migraciones. ¿Qué conclusión es más cuidadosa?",
        "options": [
          "La sequía pudo contribuir, pero se requieren más evidencias  ",
          "La sequía fue la única causa posible  ",
          "Las migraciones ocurrieron antes de la sequía  ",
          "La cronología prueba las intenciones de cada persona"
        ],
        "correctAnswer": "La sequía pudo contribuir, pero se requieren más evidencias  ",
        "explanation": "El orden temporal sugiere una posible relación, pero no basta para demostrar una causa única.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-073",
        "number": 73,
        "topic": "Historia de Colombia",
        "concept": "interpretar_junta_autogobierno_1810",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un acta de 1810 pide formar un gobierno local, pero no declara independencia absoluta. ¿Qué interpretación se ajusta mejor?",
        "options": [
          "El documento carece de valor histórico  ",
          "La separación política ya era completa  ",
          "Había demandas de autogobierno dentro de un proceso cambiante  ",
          "La población rechazaba cualquier cambio"
        ],
        "correctAnswer": "Había demandas de autogobierno dentro de un proceso cambiante  ",
        "explanation": "Las juntas de 1810 expresaron distintas posiciones de autogobierno; no todas equivalían a una independencia definitiva.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-074",
        "number": 74,
        "topic": "Historia",
        "concept": "limites_testimonio_directo",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si una fuente fue escrita por una persona que presenció un hecho, necesariamente es completa y neutral.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Ser testigo directo aporta una perspectiva, pero la memoria, el propósito y el punto de vista también influyen.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-075",
        "number": 75,
        "topic": "Historia comparada",
        "concept": "comparar_sistemas_riego_contexto",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos sociedades construyeron canales para llevar agua a sus cultivos. ¿Qué comparación permite aprender más sobre sus soluciones?",
        "options": [
          "Comparar solo el nombre de sus gobernantes  ",
          "Analizar clima, materiales y organización del trabajo  ",
          "Suponer que una copió a la otra  ",
          "Medir cuál canal se ve más recto hoy"
        ],
        "correctAnswer": "Analizar clima, materiales y organización del trabajo  ",
        "explanation": "El ambiente, la tecnología disponible y la organización social ayudan a explicar cómo cada sociedad resolvió necesidades similares.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-076",
        "number": 76,
        "topic": "Rutas históricas",
        "concept": "rutas_intercambio_seda",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué conectaba principalmente la Ruta de la Seda?",
        "options": [
          "Redes comerciales entre Asia y otras regiones  ",
          "Las ciudades mayas con el Caribe  ",
          "Los puertos romanos con América  ",
          "Las capitales del Imperio inca"
        ],
        "correctAnswer": "Redes comerciales entre Asia y otras regiones  ",
        "explanation": "La Ruta de la Seda reunió varias rutas de intercambio que conectaban regiones de Asia con otras zonas de Eurasia.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-077",
        "number": 77,
        "topic": "Historia del antiguo Japón",
        "concept": "autoridad_shogun_japon",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué grupo gobernaba en nombre del emperador durante largos periodos del Japón feudal?",
        "options": [
          "Los cónsules  ",
          "Los shogunes  ",
          "Los faraones  ",
          "Los senadores"
        ],
        "correctAnswer": "Los shogunes  ",
        "explanation": "El shogun era un dirigente militar que ejercía gran parte del poder político en distintos periodos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-078",
        "number": 78,
        "topic": "Historia antigua de China",
        "concept": "construccion_muralla_china",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué estructura histórica se amplió durante distintas dinastías para reforzar la defensa del norte de China?",
        "options": [
          "El Coliseo  ",
          "El Partenón  ",
          "La Gran Muralla  ",
          "El Camino Real inca"
        ],
        "correctAnswer": "La Gran Muralla  ",
        "explanation": "Diversos estados y dinastías construyeron o ampliaron tramos de la Gran Muralla con fines defensivos y de control.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-079",
        "number": 79,
        "topic": "Antigua Roma",
        "concept": "consul_republica_romana",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cargo elegía la República romana para encabezar el gobierno por periodos limitados?",
        "options": [
          "Faraón  ",
          "Califa  ",
          "Emperador hereditario  ",
          "Cónsul"
        ],
        "correctAnswer": "Cónsul",
        "explanation": "La República romana elegía dos cónsules cada año, aunque el acceso a los cargos estuvo limitado socialmente.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-080",
        "number": 80,
        "topic": "Historia",
        "concept": "cronologia_no_explica_causalidad",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Una cronología organiza acontecimientos, pero por sí sola no explica todas sus causas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La secuencia temporal ayuda a ubicar hechos; explicar causas requiere analizar otras evidencias y relaciones.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-081",
        "number": 81,
        "topic": "Historia medieval",
        "concept": "relaciones_feudales_europa",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llamaba el sistema de vínculos de obligaciones entre señores y vasallos en parte de la Europa medieval?",
        "options": [
          "Feudalismo  ",
          "Federalismo  ",
          "Mercantilismo  ",
          "Republicanismo"
        ],
        "correctAnswer": "Feudalismo  ",
        "explanation": "El feudalismo describe relaciones de poder y obligaciones que existieron en partes de la Europa medieval, con variaciones regionales.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-082",
        "number": 82,
        "topic": "Trabajo medieval",
        "concept": "gremios_oficios_medievales",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué agrupación reunía a personas de un mismo oficio en muchas ciudades medievales?",
        "options": [
          "Legión  ",
          "Gremio  ",
          "Senado  ",
          "Clan"
        ],
        "correctAnswer": "Gremio  ",
        "explanation": "Los gremios organizaban oficios y regulaban aspectos de la producción y formación artesanal.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-083",
        "number": 83,
        "topic": "Historia antigua de África",
        "concept": "tombuctu_mali",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ciudad fue un importante centro de comercio y aprendizaje del Imperio de Malí?",
        "options": [
          "Cartago  ",
          "Alejandría  ",
          "Tombuctú  ",
          "Constantinopla"
        ],
        "correctAnswer": "Tombuctú  ",
        "explanation": "Tombuctú fue un destacado centro comercial e intelectual en África occidental.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-084",
        "number": 84,
        "topic": "Historia",
        "concept": "jeroglificos_escritura_egipcia",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Los jeroglíficos fueron uno de los sistemas de escritura usados en el antiguo Egipto.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Los egipcios utilizaron escritura jeroglífica, entre otros sistemas y formas de escritura.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-085",
        "number": 85,
        "topic": "Comercio africano",
        "concept": "valor_comercial_sal_sahariana",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué la sal fue un producto valioso en las rutas comerciales del Sahara?",
        "options": [
          "Se usaba para construir barcos  ",
          "Reemplazaba todas las monedas  ",
          "Solo servía como adorno  ",
          "Era útil para conservar y sazonar alimentos"
        ],
        "correctAnswer": "Era útil para conservar y sazonar alimentos",
        "explanation": "La sal tenía usos cotidianos y de conservación, y se intercambiaba junto con otros productos a través del desierto.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-086",
        "number": 86,
        "topic": "Historia medieval",
        "concept": "monasterios_copia_manuscritos",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué muchos monasterios medievales copiaban manuscritos?",
        "options": [
          "Para preservar y transmitir textos  ",
          "Para fabricar herramientas agrícolas  ",
          "Para reemplazar el comercio  ",
          "Para censar todos los pueblos"
        ],
        "correctAnswer": "Para preservar y transmitir textos  ",
        "explanation": "La copia manuscrita contribuyó a conservar y difundir textos, aunque el acceso a la lectura siguió siendo desigual.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-087",
        "number": 87,
        "topic": "Historia de Colombia",
        "concept": "fundacion_poblaciones_y_control_colonial",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué se fundaron poblaciones españolas en rutas del interior durante la Colonia?",
        "options": [
          "Para abandonar el control territorial  ",
          "Para conectar zonas y administrar territorios  ",
          "Para eliminar todo intercambio local  ",
          "Para trasladar la capital a Europa"
        ],
        "correctAnswer": "Para conectar zonas y administrar territorios  ",
        "explanation": "Las poblaciones servían como centros de administración y conectaban rutas, aunque también transformaron de forma desigual las sociedades existentes.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-088",
        "number": 88,
        "topic": "Sociedades antiguas",
        "concept": "excedente_y_especializacion_urbana",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué relación facilitó el desarrollo de algunas primeras ciudades?",
        "options": [
          "La navegación aérea y la industria  ",
          "El uso de electricidad y el ferrocarril  ",
          "La producción de alimentos y la especialización de trabajos  ",
          "La desaparición del intercambio"
        ],
        "correctAnswer": "La producción de alimentos y la especialización de trabajos  ",
        "explanation": "La producción de excedentes pudo sostener poblaciones más densas y permitir que algunas personas se dedicaran a otros trabajos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-089",
        "number": 89,
        "topic": "Historia",
        "concept": "impactos_desiguales_expansion_imperial",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "La expansión de los imperios siempre benefició por igual a los pueblos que incorporó.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La expansión imperial pudo traer intercambios, pero también conquista, tributos, desplazamientos y relaciones desiguales.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-090",
        "number": 90,
        "topic": "Historia del antiguo Japón",
        "concept": "funcion_social_samurais",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué característica distinguía a los samuráis dentro de la sociedad japonesa feudal?",
        "options": [
          "Eran escribas egipcios  ",
          "Eran guerreros vinculados a señores  ",
          "Eran comerciantes venecianos  ",
          "Eran sacerdotes mayas"
        ],
        "correctAnswer": "Eran guerreros vinculados a señores  ",
        "explanation": "Los samuráis conformaban una clase guerrera asociada con el servicio a señores y autoridades militares.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-091",
        "number": 91,
        "topic": "Historia global",
        "concept": "comercio_y_crecimiento_urbano_medieval",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cambio favoreció el crecimiento de ciudades europeas durante la Baja Edad Media?",
        "options": [
          "La expansión del comercio y las ferias  ",
          "La prohibición de todo intercambio  ",
          "El abandono de la artesanía  ",
          "La desaparición de caminos"
        ],
        "correctAnswer": "La expansión del comercio y las ferias  ",
        "explanation": "El comercio y las ferias impulsaron la actividad de muchas ciudades, aunque el proceso varió según la región.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-092",
        "number": 92,
        "topic": "Historia antigua de América",
        "concept": "estelas_mayas_memoria_politica",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué los mayas registraban fechas y acontecimientos en estelas?",
        "options": [
          "Para medir la profundidad del océano  ",
          "Para almacenar granos  ",
          "Para comunicar memoria política y ritual  ",
          "Para fabricar armas de hierro"
        ],
        "correctAnswer": "Para comunicar memoria política y ritual  ",
        "explanation": "Algunas estelas mayas registraban fechas, gobernantes y acontecimientos, con funciones políticas y ceremoniales.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-093",
        "number": 93,
        "topic": "Historia de Colombia",
        "concept": "expedicion_botanica_nuevo_reino",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué caracterizó a la Expedición Botánica dirigida por José Celestino Mutis?",
        "options": [
          "Una campaña para abolir las ciudades  ",
          "La construcción del ferrocarril  ",
          "Una expedición militar al Perú  ",
          "El estudio y registro de plantas del territorio"
        ],
        "correctAnswer": "El estudio y registro de plantas del territorio",
        "explanation": "La Real Expedición Botánica del Nuevo Reino de Granada documentó la flora y reunió observaciones científicas y artísticas.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-094",
        "number": 94,
        "topic": "Historia",
        "concept": "tradicion_oral_fuente_contextual",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Los relatos orales pueden ser fuentes históricas, aunque deben analizarse considerando quién los transmite y en qué contexto.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La tradición oral transmite memoria; su análisis atiende a versiones, contexto y relación con otras evidencias.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-095",
        "number": 95,
        "topic": "Historia de Colombia",
        "concept": "puerto_caribeno_santa_marta",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función tenía el puerto de Santa Marta durante el periodo colonial?",
        "options": [
          "Era la capital del Imperio inca  ",
          "Controlaba el comercio del océano Índico  ",
          "Servía como frontera entre Asia y África  ",
          "Conectaba intercambios y navegación en el Caribe"
        ],
        "correctAnswer": "Conectaba intercambios y navegación en el Caribe",
        "explanation": "Su ubicación caribeña hizo de Santa Marta un puerto importante, dentro de rutas marítimas y procesos coloniales.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-096",
        "number": 96,
        "topic": "Interpretación de fuentes",
        "concept": "buscar_voces_ausentes_en_fuentes",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un cronista describe una rebelión desde el punto de vista de la autoridad que la reprimió. ¿Qué conviene hacer para comprender mejor a quienes participaron?",
        "options": [
          "Leer otras fuentes, incluidas voces de los participantes si se conservan  ",
          "Aceptar que el cronista representa a todos  ",
          "Ignorar la fecha del relato  ",
          "Contar cuántas páginas tiene"
        ],
        "correctAnswer": "Leer otras fuentes, incluidas voces de los participantes si se conservan  ",
        "explanation": "Contrastar perspectivas puede mostrar qué voces quedaron fuera del relato oficial y qué límites tiene cada fuente.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-097",
        "number": 97,
        "topic": "Historia comparada",
        "concept": "comparar_procesos_sin_evolucion_lineal",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos regiones desarrollaron mercados en épocas distintas. ¿Qué comparación evita asumir que siguieron una ruta idéntica?",
        "options": [
          "Comparar solo el nombre de las regiones  ",
          "Examinar sus recursos, rutas y formas de organización  ",
          "Suponer que una copió a la otra  ",
          "Ordenarlas de mejor a peor"
        ],
        "correctAnswer": "Examinar sus recursos, rutas y formas de organización  ",
        "explanation": "Comparar condiciones y decisiones locales permite reconocer similitudes sin convertirlas en una secuencia universal.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-098",
        "number": 98,
        "topic": "Historia de Colombia",
        "concept": "perspectiva_termino_descubrimiento",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un libro llama “descubrimiento” a la llegada española a América. ¿Qué pregunta ayuda a evaluar ese término?",
        "options": [
          "¿Cuántos capítulos tiene el libro?  ",
          "¿Qué tamaño tiene la letra?  ",
          "¿Desde qué perspectiva y para quién fue descrito el hecho?  ",
          "¿Cuántos mapas incluye?"
        ],
        "correctAnswer": "¿Desde qué perspectiva y para quién fue descrito el hecho?  ",
        "explanation": "La expresión depende de una perspectiva: los pueblos americanos ya habitaban el continente antes de la llegada europea.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-099",
        "number": 99,
        "topic": "Historia",
        "concept": "silencio_documental_no_prueba_ausencia",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si una fuente guarda silencio sobre un grupo, eso demuestra que dicho grupo no existía en esa sociedad.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "El silencio de una fuente puede deberse a su propósito, autor o conservación; no prueba por sí mismo ausencia histórica.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-100",
        "number": 100,
        "topic": "Cambio histórico",
        "concept": "cambio_funcion_objeto_contexto",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un objeto cambia de función con el paso del tiempo y luego se conserva en un museo. ¿Qué análisis ayuda más a explicar ese cambio?",
        "options": [
          "Medir únicamente su peso actual  ",
          "Suponer que siempre tuvo el mismo propósito  ",
          "Comparar solo el color de la vitrina  ",
          "Seguir sus usos y significados en cada contexto"
        ],
        "correctAnswer": "Seguir sus usos y significados en cada contexto",
        "explanation": "La función y el significado de los objetos pueden cambiar según quién los usa, cuándo y en qué contexto.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-101",
        "number": 101,
        "topic": "Historia antigua",
        "concept": "democracia_directa_ateniense",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué pueblo antiguo desarrolló la democracia directa en Atenas?",
        "options": [
          "Los griegos  ",
          "Los fenicios  ",
          "Los persas  ",
          "Los cartagineses"
        ],
        "correctAnswer": "Los griegos  ",
        "explanation": "En Atenas surgieron formas de participación directa, limitadas a quienes eran reconocidos como ciudadanos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-102",
        "number": 102,
        "topic": "Historia antigua",
        "concept": "origen_humano_africa",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué continente surgieron los primeros humanos según la evidencia científica actual?",
        "options": [
          "Europa  ",
          "África  ",
          "Oceanía  ",
          "América"
        ],
        "correctAnswer": "África  ",
        "explanation": "La evidencia fósil y genética sitúa los orígenes de nuestra especie en África.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-103",
        "number": 103,
        "topic": "Historia de Colombia",
        "concept": "territorio_muisca_altiplano",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué pueblo indígena habitó el altiplano Cundiboyacense antes de la conquista española?",
        "options": [
          "Tairona  ",
          "Zenú  ",
          "Muisca  ",
          "Quimbaya"
        ],
        "correctAnswer": "Muisca  ",
        "explanation": "Los muiscas habitaron principalmente el altiplano Cundiboyacense y sus alrededores.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-104",
        "number": 104,
        "topic": "Historia antigua",
        "concept": "navegacion_comercio_fenicio",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Los fenicios fueron conocidos por su navegación y sus redes de intercambio por el Mediterráneo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las ciudades fenicias desarrollaron navegación y comercio marítimo en el Mediterráneo.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-105",
        "number": 105,
        "topic": "Historia antigua",
        "concept": "importancia_rio_nilo",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué río fue esencial para la agricultura y la vida del antiguo Egipto?",
        "options": [
          "Tigris  ",
          "Nilo  ",
          "Amazonas  ",
          "Éufrates"
        ],
        "correctAnswer": "Nilo  ",
        "explanation": "El Nilo y sus crecidas condicionaron la agricultura y el asentamiento en el antiguo Egipto.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-106",
        "number": 106,
        "topic": "Historia moderna",
        "concept": "imprenta_tipos_moviles",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué invento permitió imprimir múltiples copias de textos mediante tipos móviles en Europa?",
        "options": [
          "Telégrafo  ",
          "Telescopio  ",
          "Imprenta  ",
          "Máquina de vapor"
        ],
        "correctAnswer": "Imprenta  ",
        "explanation": "La imprenta de tipos móviles permitió reproducir textos en mayor cantidad que la copia manual.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-107",
        "number": 107,
        "topic": "Historia",
        "concept": "revision_interpretacion_historica",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La evidencia histórica puede modificarse cuando aparecen nuevos hallazgos o se revisan las fuentes.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las interpretaciones pueden cambiar si surge nueva evidencia o se analizan mejor los materiales existentes.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-108",
        "number": 108,
        "topic": "Historia antigua de América",
        "concept": "territorio_mexica_valle_mexico",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué zona se desarrolló principalmente el Imperio mexica o azteca?",
        "options": [
          "Valle de México  ",
          "Altiplano andino  ",
          "Sierra Nevada de Santa Marta  ",
          "Llanura del río Indo"
        ],
        "correctAnswer": "Valle de México  ",
        "explanation": "Los mexicas establecieron su centro político en Tenochtitlan, en el actual valle de México.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-109",
        "number": 109,
        "topic": "Historia antigua de Colombia",
        "concept": "orfebreria_quimbaya_oro",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué recurso se asocia especialmente con la orfebrería de la cultura quimbaya?",
        "options": [
          "Mármol  ",
          "Oro  ",
          "Ámbar  ",
          "Hierro"
        ],
        "correctAnswer": "Oro  ",
        "explanation": "Los quimbayas son reconocidos por su tradición de orfebrería, especialmente en oro.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-110",
        "number": 110,
        "topic": "Historia antigua",
        "concept": "mar_egeo_navegacion_intercambio",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué facilitó la ubicación de muchas ciudades griegas alrededor del mar Egeo?",
        "options": [
          "El cultivo de arroz en grandes valles  ",
          "El aislamiento de toda ruta marítima  ",
          "La navegación y el intercambio entre costas e islas  ",
          "El control de las rutas del Atlántico"
        ],
        "correctAnswer": "La navegación y el intercambio entre costas e islas  ",
        "explanation": "Las costas e islas del Egeo favorecieron la navegación y distintos intercambios, aunque también existieron rivalidades.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-111",
        "number": 111,
        "topic": "Historia antigua",
        "concept": "rios_y_sociedades_antiguas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué rasgo compartieron varias civilizaciones que crecieron en valles fluviales?",
        "options": [
          "Dependían solo de la caza en montañas  ",
          "Evitaban asentarse junto al agua  ",
          "No desarrollaron agricultura  ",
          "Aprovecharon ríos para agua, transporte o cultivo"
        ],
        "correctAnswer": "Aprovecharon ríos para agua, transporte o cultivo",
        "explanation": "Los ríos ofrecían recursos importantes, aunque cada sociedad los aprovechó de manera distinta.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-112",
        "number": 112,
        "topic": "Historia",
        "concept": "exclusion_democracia_ateniense",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En la democracia ateniense, las mujeres y las personas esclavizadas participaban en igualdad de condiciones con los ciudadanos varones.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La ciudadanía y la participación política estaban restringidas; mujeres y personas esclavizadas estaban excluidas.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-113",
        "number": 113,
        "topic": "Historia global",
        "concept": "uso_historico_brujula",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué la brújula fue importante para la navegación?",
        "options": [
          "Ayudaba a orientarse señalando direcciones  ",
          "Medía la profundidad del mar  ",
          "Predecía con exactitud las tormentas  ",
          "Indicaba la velocidad de un barco"
        ],
        "correctAnswer": "Ayudaba a orientarse señalando direcciones  ",
        "explanation": "La brújula indica direcciones y ayudó a navegantes a orientarse, junto con otros instrumentos y conocimientos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-114",
        "number": 114,
        "topic": "Historia de Colombia",
        "concept": "impactos_diversos_conquista_indigena",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ocurrió con los pueblos indígenas durante la conquista y colonización españolas?",
        "options": [
          "Todos conservaron sin cambios su territorio  ",
          "Sus poblaciones y formas de vida fueron afectadas de distintas maneras  ",
          "Desaparecieron de inmediato todos sus idiomas  ",
          "Ninguna comunidad tuvo contacto con los europeos"
        ],
        "correctAnswer": "Sus poblaciones y formas de vida fueron afectadas de distintas maneras  ",
        "explanation": "La conquista produjo violencia, epidemias y cambios sociales, pero los pueblos indígenas resistieron, negociaron y persistieron de formas diversas.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-115",
        "number": 115,
        "topic": "Historia global",
        "concept": "redes_intercambio_mundo_islamico",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué difundió la expansión del islam desde el siglo VII, además de la religión?",
        "options": [
          "Solo técnicas de navegación polinesia  ",
          "Exclusivamente la escritura cuneiforme  ",
          "Conocimientos, comercio y tradiciones culturales  ",
          "Únicamente la lengua latina"
        ],
        "correctAnswer": "Conocimientos, comercio y tradiciones culturales  ",
        "explanation": "Las sociedades musulmanas participaron en redes de intercambio y transmisión de conocimientos diversos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-116",
        "number": 116,
        "topic": "Historia de Colombia",
        "concept": "fecha_abolicion_esclavitud_colombia",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "La abolición legal de la esclavitud en Colombia ocurrió el mismo día de la independencia de 1810.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La abolición se decretó en 1851 y entró en vigor en 1852, décadas después de 1810.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-117",
        "number": 117,
        "topic": "Historia global",
        "concept": "objetivos_independencias_americanas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué buscaban principalmente los movimientos de independencia americanos del siglo XIX?",
        "options": [
          "Restaurar el dominio colonial europeo  ",
          "Crear nuevas dependencias de Asia  ",
          "Detener toda actividad política  ",
          "Romper vínculos de gobierno colonial y formar nuevos estados"
        ],
        "correctAnswer": "Romper vínculos de gobierno colonial y formar nuevos estados",
        "explanation": "Los movimientos tuvieron objetivos y resultados diversos, pero muchos buscaron terminar el dominio colonial y establecer gobiernos propios.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-118",
        "number": 118,
        "topic": "Historia moderna",
        "concept": "maquina_vapor_industria_transporte",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cambió la máquina de vapor durante la Revolución industrial?",
        "options": [
          "La agricultura dejó de existir  ",
          "Aportó energía a fábricas y transportes  ",
          "Se prohibió el comercio  ",
          "Desaparecieron las ciudades"
        ],
        "correctAnswer": "La agricultura dejó de existir  ",
        "explanation": "La máquina de vapor impulsó procesos industriales y transportes; no eliminó la agricultura ni transformó todo de inmediato.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-119",
        "number": 119,
        "topic": "Historia política",
        "concept": "cambio_fronteras_historicas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué puede modificar una frontera política con el paso del tiempo?",
        "options": [
          "Un cambio en las estaciones  ",
          "La creación de una obra artística  ",
          "La variación de los cultivos  ",
          "Guerras, acuerdos o independencias"
        ],
        "correctAnswer": "Guerras, acuerdos o independencias",
        "explanation": "Las fronteras pueden transformarse por tratados, conflictos y procesos de independencia.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-120",
        "number": 120,
        "topic": "Historia de Colombia",
        "concept": "junta_santafe_20_julio",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué hecho conmemora el 20 de julio como fecha histórica en Colombia?",
        "options": [
          "La batalla del Pantano de Vargas  ",
          "La abolición de la esclavitud  ",
          "La Constitución de 1991  ",
          "La formación de una junta de gobierno en Santafé en 1810"
        ],
        "correctAnswer": "La formación de una junta de gobierno en Santafé en 1810",
        "explanation": "El 20 de julio recuerda los sucesos de Santafé de 1810 y la formación de una junta en un proceso político más amplio.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-121",
        "number": 121,
        "topic": "Interpretación histórica",
        "concept": "diversidad_actores_historicos",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un texto escolar dice que “la historia la hacen únicamente los grandes gobernantes”. ¿Qué evidencia cuestiona mejor esa idea?",
        "options": [
          "Registros sobre la vida y las acciones de distintos grupos sociales  ",
          "Una lista de fechas de reinados  ",
          "Un retrato de un monarca  ",
          "Un mapa sin leyenda"
        ],
        "correctAnswer": "Registros sobre la vida y las acciones de distintos grupos sociales  ",
        "explanation": "Las fuentes sobre trabajadores, comunidades, mujeres y otros grupos muestran que la historia incluye más actores que los gobernantes.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-122",
        "number": 122,
        "topic": "Historia de Colombia",
        "concept": "contexto_y_procedencia_pieza_indigena",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un museo exhibe una pieza indígena sin indicar quién la produjo ni de qué comunidad proviene. ¿Qué información ayudaría más a contextualizarla?",
        "options": [
          "El precio de la vitrina  ",
          "Procedencia, comunidad y uso documentado  ",
          "El peso del edificio  ",
          "El número de visitantes"
        ],
        "correctAnswer": "Procedencia, comunidad y uso documentado  ",
        "explanation": "La procedencia y la información comunitaria permiten interpretar mejor la pieza y reconocer su contexto cultural.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-123",
        "number": 123,
        "topic": "Historia",
        "concept": "diferencias_perspectiva_no_prueban_mentira",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si dos fuentes cuentan un acontecimiento de manera diferente, una de ellas necesariamente miente.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Las fuentes pueden reflejar experiencias, propósitos o perspectivas distintas; es necesario contrastarlas antes de juzgar.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-124",
        "number": 124,
        "topic": "Historia global",
        "concept": "evaluar_fecha_mapa_historico",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un mapa muestra rutas comerciales, pero fue elaborado siglos después de las rutas representadas. ¿Cómo debería usarse?",
        "options": [
          "Como registro directo hecho por un comerciante de la época  ",
          "Como prueba de que todos viajaban por igual  ",
          "Como fuente posterior cuya información debe contrastarse  ",
          "Como documento sin ningún valor"
        ],
        "correctAnswer": "Como fuente posterior cuya información debe contrastarse  ",
        "explanation": "Un mapa posterior puede sintetizar información útil, pero su fecha y propósito deben considerarse al interpretarlo.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-125",
        "number": 125,
        "topic": "Historia",
        "concept": "continuidad_y_cambio_memoria_colectiva",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una comunidad transmite una tradición durante generaciones y la adapta a nuevos contextos. ¿Qué conclusión es más razonable?",
        "options": [
          "La tradición dejó de tener valor  ",
          "La comunidad olvidó toda su historia  ",
          "La versión más antigua siempre es la única válida  ",
          "La memoria puede conservarse y transformarse"
        ],
        "correctAnswer": "La memoria puede conservarse y transformarse",
        "explanation": "Las tradiciones pueden mantener elementos del pasado y, al mismo tiempo, cambiar según las experiencias de cada generación.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-126",
        "number": 126,
        "topic": "Historia antigua",
        "concept": "machu_picchu_inca",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué civilización construyó Machu Picchu?",
        "options": [
          "Inca  ",
          "Maya  ",
          "Mexica  ",
          "Muisca"
        ],
        "correctAnswer": "Inca  ",
        "explanation": "Machu Picchu es un sitio arqueológico asociado con la civilización inca, en los Andes peruanos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-127",
        "number": 127,
        "topic": "Historia de Colombia",
        "concept": "infraestructura_tairona_sierra_nevada",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué pueblo indígena construyó caminos y terrazas en la Sierra Nevada de Santa Marta?",
        "options": [
          "Muisca  ",
          "Tairona  ",
          "Quimbaya  ",
          "Calima"
        ],
        "correctAnswer": "Tairona  ",
        "explanation": "Los taironas construyeron asentamientos, caminos y terrazas en distintos sectores de la Sierra Nevada.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-128",
        "number": 128,
        "topic": "Historia antigua",
        "concept": "epigrafia_inscripciones",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama la disciplina que estudia inscripciones antiguas?",
        "options": [
          "Paleontología  ",
          "Cartografía  ",
          "Epigrafía  ",
          "Numismática"
        ],
        "correctAnswer": "Epigrafía  ",
        "explanation": "La epigrafía estudia inscripciones realizadas en materiales como piedra, metal o cerámica.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-129",
        "number": 129,
        "topic": "Historia",
        "concept": "moneda_evidencia_historica",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Una moneda antigua puede aportar evidencia sobre gobernantes, símbolos o intercambios de su época.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las monedas pueden informar sobre imágenes oficiales, circulación y actividad económica, aunque deben interpretarse en contexto.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-130",
        "number": 130,
        "topic": "Historia antigua de América",
        "concept": "cultivo_maiz_mesoamerica",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cultivo fue fundamental para muchas sociedades mesoamericanas?",
        "options": [
          "Trigo  ",
          "Arroz  ",
          "Cebada  ",
          "Maíz"
        ],
        "correctAnswer": "Maíz",
        "explanation": "El maíz fue un alimento central en distintas sociedades de Mesoamérica.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-131",
        "number": 131,
        "topic": "Historia antigua",
        "concept": "soporte_escritura_papiro",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué soporte usaban muchas sociedades antiguas para escribir antes del papel moderno?",
        "options": [
          "Papiro  ",
          "Plástico  ",
          "Aluminio  ",
          "Acetato"
        ],
        "correctAnswer": "Papiro  ",
        "explanation": "El papiro fue un soporte de escritura elaborado a partir de una planta y usado especialmente en el antiguo Egipto.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-132",
        "number": 132,
        "topic": "Historia medieval",
        "concept": "capital_imperio_bizantino",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ciudad fue la capital del Imperio bizantino durante gran parte de su historia?",
        "options": [
          "Roma  ",
          "Constantinopla  ",
          "París  ",
          "Cuzco"
        ],
        "correctAnswer": "Constantinopla  ",
        "explanation": "Constantinopla fue la capital del Imperio bizantino y un centro político y comercial.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-133",
        "number": 133,
        "topic": "Historia",
        "concept": "objeto_como_evidencia_y_pregunta",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Un objeto encontrado en una excavación puede ayudar a formular preguntas sobre la vida de quienes lo usaron.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Los objetos aportan pistas, pero su ubicación y relación con otros hallazgos también importan.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-134",
        "number": 134,
        "topic": "Historia global",
        "concept": "funcion_caravanas_comerciales",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función cumplían las caravanas en rutas comerciales terrestres?",
        "options": [
          "Navegar entre islas  ",
          "Construir caminos de piedra  ",
          "Transportar personas y mercancías en grupo  ",
          "Medir la altura de las montañas"
        ],
        "correctAnswer": "Transportar personas y mercancías en grupo  ",
        "explanation": "Las caravanas permitían transportar bienes y viajeros a través de rutas terrestres, en ocasiones largas y difíciles.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-135",
        "number": 135,
        "topic": "Historia antigua",
        "concept": "definicion_ciudad_estado",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué era una ciudad-Estado como Atenas en la antigua Grecia?",
        "options": [
          "Una provincia del Imperio inca  ",
          "Una colonia romana en América  ",
          "Un territorio sin gobierno propio  ",
          "Una ciudad con gobierno y territorio propios"
        ],
        "correctAnswer": "Una ciudad con gobierno y territorio propios",
        "explanation": "Una ciudad-Estado organizaba políticamente una ciudad y el territorio que dependía de ella.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-136",
        "number": 136,
        "topic": "Historia",
        "concept": "formas_intercambio_no_monetario",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El intercambio comercial antiguo consistía únicamente en comprar y vender con monedas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "También existieron trueque, regalos, tributos y otras formas de circulación de bienes.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-137",
        "number": 137,
        "topic": "Historia de Colombia",
        "concept": "usos_sociales_oro_indigena",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué relación tenían el oro y la orfebrería en varias sociedades indígenas de Colombia?",
        "options": [
          "El oro se usaba exclusivamente como moneda  ",
          "Se elaboraban objetos con funciones simbólicas y sociales  ",
          "No existía trabajo especializado del metal  ",
          "Todo objeto de oro se fabricaba para exportación"
        ],
        "correctAnswer": "Se elaboraban objetos con funciones simbólicas y sociales  ",
        "explanation": "Los objetos de metal podían tener usos rituales, políticos y sociales, además de reflejar técnicas especializadas.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-138",
        "number": 138,
        "topic": "Historia global",
        "concept": "trabajo_asalariado_fabril",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cambio social acompañó el crecimiento de fábricas durante la Revolución industrial?",
        "options": [
          "El fin inmediato de las diferencias sociales  ",
          "La desaparición del trabajo urbano  ",
          "La expansión del trabajo asalariado fabril  ",
          "El abandono total de la agricultura"
        ],
        "correctAnswer": "La expansión del trabajo asalariado fabril  ",
        "explanation": "Las fábricas ampliaron el trabajo asalariado urbano, aunque la agricultura y otros trabajos continuaron.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-139",
        "number": 139,
        "topic": "Historia de Colombia",
        "concept": "participacion_policarpa_independencia",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué se recuerda a Policarpa Salavarrieta en la historia de la independencia?",
        "options": [
          "Por liderar la construcción de Cartagena  ",
          "Por fundar el Imperio muisca  ",
          "Por redactar la Constitución de 1991  ",
          "Por apoyar redes patriotas durante la Reconquista española"
        ],
        "correctAnswer": "Por apoyar redes patriotas durante la Reconquista española",
        "explanation": "Policarpa participó en redes de apoyo a la causa patriota y fue ejecutada en 1817 durante la Reconquista.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-140",
        "number": 140,
        "topic": "Historia",
        "concept": "diversidad_organizacion_sociedades_antiguas",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Todas las sociedades antiguas tenían el mismo sistema de gobierno y organización social.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Las sociedades antiguas tuvieron instituciones y formas de organización distintas, que además cambiaron con el tiempo.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-141",
        "number": 141,
        "topic": "Historia global",
        "concept": "ferrocarril_conectividad_siglo_xix",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué efecto tuvo la expansión del ferrocarril en el siglo XIX?",
        "options": [
          "Redujo tiempos de transporte y conectó regiones  ",
          "Eliminó los viajes terrestres  ",
          "Impidió trasladar mercancías  ",
          "Suprimió toda actividad portuaria"
        ],
        "correctAnswer": "Redujo tiempos de transporte y conectó regiones  ",
        "explanation": "El ferrocarril aceleró el transporte de personas y bienes y modificó conexiones entre regiones.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-142",
        "number": 142,
        "topic": "Análisis de fuentes",
        "concept": "seleccion_y_omision_relato_historico",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ayuda a evaluar por qué un relato histórico omite ciertos hechos?",
        "options": [
          "Comparar autoría, propósito y otras fuentes  ",
          "Suponer que toda omisión fue intencional  ",
          "Contar las palabras del relato  ",
          "Revisar únicamente el color del papel"
        ],
        "correctAnswer": "Comparar autoría, propósito y otras fuentes  ",
        "explanation": "La autoría y el propósito ayudan a entender qué seleccionó el relato; el contraste con otras fuentes amplía la perspectiva.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-143",
        "number": 143,
        "topic": "Historia de Colombia",
        "concept": "virreinato_nueva_granada",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué fue el Virreinato de la Nueva Granada?",
        "options": [
          "Una ciudad indígena prehispánica  ",
          "Una república independiente del siglo XX  ",
          "Una unidad administrativa de la monarquía española en América  ",
          "Una alianza comercial del Imperio inca"
        ],
        "correctAnswer": "Una unidad administrativa de la monarquía española en América  ",
        "explanation": "El virreinato fue una unidad de gobierno colonial español que abarcó territorios del norte de Sudamérica.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-144",
        "number": 144,
        "topic": "Patrimonio",
        "concept": "funcion_museo_patrimonio",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué tarea puede cumplir un museo con una colección histórica?",
        "options": [
          "Sustituir todos los archivos y testimonios  ",
          "Asegurar que todas las piezas tengan el mismo origen  ",
          "Modernizar cada objeto para que luzca nuevo  ",
          "Conservarla, estudiarla y comunicar su contexto"
        ],
        "correctAnswer": "Conservarla, estudiarla y comunicar su contexto",
        "explanation": "Los museos conservan, estudian y comunican colecciones, junto con sus historias y contextos.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-145",
        "number": 145,
        "topic": "Arqueología",
        "concept": "contexto_estratigrafico_hallazgo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una excavación, un objeto aparece bajo una capa de suelo y otro sobre ella. ¿Qué dato ayuda a interpretar su relación temporal?",
        "options": [
          "El color de las etiquetas actuales  ",
          "La posición estratigráfica y el contexto de cada objeto  ",
          "La altura del investigador  ",
          "El tamaño de la caja de transporte"
        ],
        "correctAnswer": "La posición estratigráfica y el contexto de cada objeto  ",
        "explanation": "La posición dentro de capas y su asociación con otros materiales aportan información temporal, si el contexto no fue alterado.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-146",
        "number": 146,
        "topic": "Historia de Colombia",
        "concept": "memoria_publica_y_voces_omitidas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un monumento conmemora una batalla, pero no menciona a la población civil afectada. ¿Qué análisis ampliaría la interpretación?",
        "options": [
          "Investigar testimonios y consecuencias para distintos grupos  ",
          "Medir la altura del monumento  ",
          "Repetir únicamente la inscripción  ",
          "Ignorar cuándo se construyó"
        ],
        "correctAnswer": "Investigar testimonios y consecuencias para distintos grupos  ",
        "explanation": "El monumento muestra una memoria seleccionada; otras fuentes pueden revelar experiencias y consecuencias omitidas.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-147",
        "number": 147,
        "topic": "Historia",
        "concept": "evaluar_fuente_tardia_y_origen",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un documento fue escrito muchos años después de un acontecimiento y repite una versión popular. ¿Qué conviene evaluar primero?",
        "options": [
          "Si tiene ilustraciones  ",
          "La fuente de su información y su distancia temporal  ",
          "Cuántas hojas tiene  ",
          "Si el autor usó tinta oscura"
        ],
        "correctAnswer": "La fuente de su información y su distancia temporal  ",
        "explanation": "Revisar de dónde proviene la información y cuándo se escribió ayuda a valorar su fiabilidad.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-148",
        "number": 148,
        "topic": "Historia global",
        "concept": "comparar_memorias_de_un_encuentro",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos comunidades conservaron relatos diferentes sobre un mismo encuentro. ¿Qué enfoque permite estudiarlos con cuidado?",
        "options": [
          "Declarar correcta la versión más breve  ",
          "Elegir la versión que aparece primero en un libro  ",
          "Comparar contexto, propósito y evidencia de cada relato  ",
          "Suponer que ambas describen exactamente lo mismo"
        ],
        "correctAnswer": "Comparar contexto, propósito y evidencia de cada relato  ",
        "explanation": "Comparar contexto y propósito permite comprender perspectivas diferentes sin asumir que una fuente agota lo ocurrido.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-149",
        "number": 149,
        "topic": "Historia",
        "concept": "conservacion_y_uso_adaptativo",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Conservar un edificio histórico significa que nunca puede adaptarse a nuevos usos.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La conservación puede permitir usos nuevos, siempre que se protejan los valores y elementos patrimoniales relevantes.",
        "stability": "STABLE"
      },
      {
        "id": "HIS6-150",
        "number": 150,
        "topic": "Historia",
        "concept": "cronologia_museografica_contextual",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una exposición presenta objetos de varios siglos como si todos hubieran sido usados al mismo tiempo. ¿Qué mejora evitaría esa confusión?",
        "options": [
          "Mostrar únicamente los objetos más grandes  ",
          "Ocultar las fechas disponibles  ",
          "Ordenarlos por precio  ",
          "Ubicarlos en una cronología con contexto"
        ],
        "correctAnswer": "Ubicarlos en una cronología con contexto",
        "explanation": "Fechas y contexto ayudan a distinguir periodos y comprender cambios entre los objetos.",
        "stability": "STABLE"
      }
    ]
  },
  {
    "catalogId": "edusyn-deportes-grade-6-v1",
    "title": "Deportes · 6.º",
    "grade": 6,
    "subjectArea": "Duelos",
    "category": "Deportes",
    "version": "1.0",
    "availability": "institution-opt-in",
    "editorialStatus": "ready-for-import",
    "audit": {
      "questions": 150,
      "multipleChoice": 120,
      "trueFalse": 30,
      "difficulty": {
        "basic": 50,
        "intermediate": 70,
        "application": 30
      },
      "answerPositions": {
        "A": 30,
        "B": 30,
        "C": 30,
        "D": 30
      },
      "conceptsPresent": 150,
      "conceptsMissing": 0
    },
    "questions": [
      {
        "id": "DEP6-001",
        "number": 1,
        "topic": "Baloncesto",
        "concept": "valor_lanzamiento_dentro_arco",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En baloncesto, ¿cuántos puntos vale normalmente un lanzamiento convertido dentro del arco de tres?",
        "options": [
          "Dos",
          "Uno",
          "Tres",
          "Cuatro"
        ],
        "correctAnswer": "Dos",
        "explanation": "Un lanzamiento convertido desde dentro del arco vale dos puntos en las reglas FIBA.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-002",
        "number": 2,
        "topic": "Voleibol",
        "concept": "maximo_tres_golpes_voleibol",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuántos toques puede realizar un equipo para devolver el balón, sin contar el bloqueo?",
        "options": [
          "Dos",
          "Tres",
          "Cuatro",
          "Cinco"
        ],
        "correctAnswer": "Tres",
        "explanation": "El equipo dispone de hasta tres golpes para devolver el balón; el contacto de bloqueo no cuenta entre ellos.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-003",
        "number": 3,
        "topic": "Atletismo",
        "concept": "identificar_carrera_vallas",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué prueba de pista combina carrera con saltos sobre obstáculos?",
        "options": [
          "Relevo",
          "Marcha",
          "Carrera con vallas",
          "Salto alto"
        ],
        "correctAnswer": "Carrera con vallas",
        "explanation": "En las carreras con vallas, los atletas corren una distancia y superan obstáculos ubicados en la pista.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-004",
        "number": 4,
        "topic": "Tenis",
        "concept": "love_cero_tenis",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En el marcador del tenis, ¿qué significa “love”?",
        "options": [
          "Ventaja",
          "Empate",
          "Punto de partido",
          "Cero"
        ],
        "correctAnswer": "Cero",
        "explanation": "En la puntuación tradicional del tenis, “love” indica cero puntos.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-005",
        "number": 5,
        "topic": "Baloncesto 3x3",
        "concept": "jugadores_en_cancha_baloncesto_3x3",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En el baloncesto 3x3 oficial, cada equipo inicia con tres jugadores en la cancha.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El formato oficial 3x3 se juega con tres integrantes por equipo en la cancha.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-006",
        "number": 6,
        "topic": "Fútbol",
        "concept": "zona_uso_manos_guardameta",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué zona puede el guardameta usar las manos, si se cumplen las demás reglas?",
        "options": [
          "En su propia área penal",
          "En el círculo central",
          "En cualquier parte del campo",
          "En el área penal rival"
        ],
        "correctAnswer": "En su propia área penal",
        "explanation": "El guardameta puede jugar el balón con las manos dentro de su propia área penal, sujeto a las demás reglas del juego.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-007",
        "number": 7,
        "topic": "Judo",
        "concept": "ippon_victoria_judo",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ocurre cuando un judoca logra un *ippon* válido?",
        "options": [
          "Recibe una advertencia",
          "Se reinicia el combate",
          "Gana el combate",
          "Obtiene un punto de saque"
        ],
        "correctAnswer": "Gana el combate",
        "explanation": "El *ippon* es la puntuación que define la victoria inmediata en judo.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-008",
        "number": 8,
        "topic": "Atletismo",
        "concept": "testigo_carrera_relevos",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué objeto se entrega de un corredor a otro en una carrera de relevos?",
        "options": [
          "Una bandera",
          "Un testigo de salida",
          "Una cinta de meta",
          "Un testigo o bastón"
        ],
        "correctAnswer": "Un testigo o bastón",
        "explanation": "En los relevos, cada integrante pasa el testigo al siguiente corredor durante la zona de entrega.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-009",
        "number": 9,
        "topic": "Voleibol",
        "concept": "secuencia_recibir_colocar_atacar",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Tras recibir y acomodar el balón, ¿qué acción aprovecha el tercer contacto del equipo?",
        "options": [
          "Sostenerlo antes de lanzarlo",
          "Atacarlo hacia el campo contrario",
          "Pasarlo por debajo de la red con la mano",
          "Dar un cuarto toque para asegurar"
        ],
        "correctAnswer": "Atacarlo hacia el campo contrario",
        "explanation": "Una secuencia habitual es recibir, colocar y atacar en el tercer golpe, aunque el equipo puede devolverlo antes.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-010",
        "number": 10,
        "topic": "Baloncesto",
        "concept": "doble_drible",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una jugadora deja de botar, sostiene el balón y vuelve a botarlo. ¿Qué infracción comete?",
        "options": [
          "Doble drible",
          "Saque de banda",
          "Bloqueo legal",
          "Falta técnica"
        ],
        "correctAnswer": "Doble drible",
        "explanation": "Tras terminar el drible y controlar el balón, no se puede comenzar a botarlo de nuevo, salvo excepciones reglamentarias.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-011",
        "number": 11,
        "topic": "Fútbol",
        "concept": "tecnica_saque_de_banda",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se ejecuta correctamente un saque de banda?",
        "options": [
          "Con un solo pie dentro del campo",
          "Con ambas manos desde detrás y por encima de la cabeza",
          "Con el balón apoyado en el suelo y golpeado con el pie",
          "Lanzándolo desde cualquier lugar de la cancha"
        ],
        "correctAnswer": "Con ambas manos desde detrás y por encima de la cabeza",
        "explanation": "El saque se realiza con ambas manos desde detrás y por encima de la cabeza, desde el punto por donde salió el balón.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-012",
        "number": 12,
        "topic": "Tenis",
        "concept": "ventaja_despues_deuce",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En un juego con puntuación tradicional, después del empate 40–40 una persona debe ganar dos puntos seguidos para cerrar el juego.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "En el sistema con ventaja, ganar el punto después del empate da ventaja; ganar el siguiente cierra el juego. Si el rival lo gana, se vuelve al empate.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-013",
        "number": 13,
        "topic": "Voleibol",
        "concept": "rotacion_horaria_voleibol",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Cuando el equipo receptor gana la jugada y obtiene el saque, ¿en qué dirección rotan sus jugadores?",
        "options": [
          "En diagonal",
          "En sentido antihorario",
          "En sentido horario",
          "No rotan durante el partido"
        ],
        "correctAnswer": "En sentido horario",
        "explanation": "Al recuperar el derecho al saque, el equipo rota una posición en sentido horario.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-014",
        "number": 14,
        "topic": "Rugby",
        "concept": "pase_hacia_delante_rugby",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué pase infringe la regla básica de avance con las manos?",
        "options": [
          "Un pase hacia atrás",
          "Un pase lateral",
          "Una entrega corta hacia atrás",
          "Un pase intencional hacia delante"
        ],
        "correctAnswer": "Un pase intencional hacia delante",
        "explanation": "En rugby no se puede lanzar o pasar intencionalmente el balón hacia delante con las manos.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-015",
        "number": 15,
        "topic": "Fútbol",
        "concept": "regla_de_ventaja_futbol",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "El árbitro señala una falta, pero el equipo que la recibió conserva una clara ocasión de ataque. ¿Qué puede aplicar el árbitro?",
        "options": [
          "La ventaja y dejar continuar la jugada",
          "Terminar el partido de inmediato",
          "Cambiar el saque al equipo infractor",
          "Detener el juego en todos los casos"
        ],
        "correctAnswer": "La ventaja y dejar continuar la jugada",
        "explanation": "La regla de ventaja permite continuar si detener el juego perjudicaría al equipo que recibió la falta.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-016",
        "number": 16,
        "topic": "Ciclismo",
        "concept": "rueda_y_resistencia_aire_ciclismo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En un tramo llano, ¿por qué un ciclista puede ubicarse detrás de otro?",
        "options": [
          "Para aumentar la resistencia del aire",
          "Para reducir el esfuerzo frente al viento",
          "Para evitar pedalear",
          "Para acortar oficialmente la distancia"
        ],
        "correctAnswer": "Para reducir el esfuerzo frente al viento",
        "explanation": "Ir a rueda puede reducir la resistencia del aire que enfrenta el ciclista, aunque requiere coordinación y atención.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-017",
        "number": 17,
        "topic": "Natación",
        "concept": "calentamiento_general_y_especifico",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Un calentamiento puede combinar movimientos generales con ejercicios propios de la actividad que se va a realizar.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El calentamiento suele incluir una parte general y otra específica de la disciplina.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-018",
        "number": 18,
        "topic": "Tenis",
        "concept": "pasillos_validos_en_dobles",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué zona adicional se considera válida en un partido de dobles, comparado con uno individual?",
        "options": [
          "La línea de fondo",
          "El cuadro de saque",
          "Los pasillos laterales",
          "La red"
        ],
        "correctAnswer": "Los pasillos laterales",
        "explanation": "En dobles se amplía el ancho válido de la cancha e incluye los pasillos laterales.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-019",
        "number": 19,
        "topic": "Baloncesto",
        "concept": "cambio_defensivo_tras_pantalla",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Después de una pantalla, las defensoras intercambian a quién marcan. ¿Qué ajuste hicieron?",
        "options": [
          "Pasaron a defensa en zona",
          "Hicieron un doble equipo",
          "Cambiaron las marcas",
          "Solicitaron una sustitución"
        ],
        "correctAnswer": "Cambiaron las marcas",
        "explanation": "En un cambio defensivo, las defensoras intercambian sus asignaciones para cubrir a las jugadoras atacantes.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-020",
        "number": 20,
        "topic": "Deporte paralímpico",
        "concept": "proposito_clasificacion_para_deporte",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Para qué sirve principalmente la clasificación en el deporte paralímpico?",
        "options": [
          "Clasificar atletas por sus medallas previas",
          "Agrupar solo por edad y experiencia",
          "Reunir todas las discapacidades en una sola clase",
          "Crear clases según el impacto en las tareas de cada deporte"
        ],
        "correctAnswer": "Crear clases según el impacto en las tareas de cada deporte",
        "explanation": "La clasificación busca reducir el efecto de la discapacidad en el resultado, considerando las tareas propias de cada deporte.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-021",
        "number": 21,
        "topic": "Fútbol",
        "concept": "pase_al_espacio_libre",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un defensor sale a presionar al jugador con el balón y deja libre a una compañera que corre hacia el espacio. ¿Qué decisión puede aprovechar mejor la situación?",
        "options": [
          "Pasar al espacio donde avanza la compañera",
          "Conducir directamente hacia el defensor",
          "Lanzar el balón fuera del campo",
          "Detenerse y esperar a que se cierre el espacio"
        ],
        "correctAnswer": "Pasar al espacio donde avanza la compañera",
        "explanation": "Un pase oportuno al espacio libre puede aprovechar el movimiento defensivo y la carrera de la compañera.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-022",
        "number": 22,
        "topic": "Baloncesto",
        "concept": "responder_a_doble_marca",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos defensores se acercan a quien lleva el balón y una compañera queda libre. ¿Qué respuesta ofrece más opciones al ataque?",
        "options": [
          "Botar hacia ambos defensores",
          "Pasar a la compañera libre",
          "Lanzar el balón sin mirar",
          "Dejar el balón en el suelo"
        ],
        "correctAnswer": "Pasar a la compañera libre",
        "explanation": "Pasar a una compañera libre aprovecha el espacio que dejaron los defensores y mantiene la posesión.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-023",
        "number": 23,
        "topic": "Estrategia",
        "concept": "decision_tiro_segun_contexto",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si un equipo va perdiendo por un punto al final de un partido de baloncesto, lanzar un triple es siempre mejor que buscar un tiro de dos puntos sin marca.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La mejor decisión depende del tiempo restante, la posición y la probabilidad de convertir; ningún tipo de tiro es siempre superior.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-024",
        "number": 24,
        "topic": "Atletismo",
        "concept": "ajustar_carrera_salto_longitud",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una saltadora de longitud pisa repetidamente más allá de la línea de batida. ¿Qué ajuste ayudaría a evitar que el salto sea nulo?",
        "options": [
          "Acelerar solo durante los últimos pasos",
          "Cambiar la caída en la arena",
          "Despegar con ambos pies",
          "Ajustar la marca de salida para llegar antes de la línea"
        ],
        "correctAnswer": "Ajustar la marca de salida para llegar antes de la línea",
        "explanation": "Revisar la marca de inicio de la carrera ayuda a coordinar el impulso sin sobrepasar la línea de batida.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-025",
        "number": 25,
        "topic": "Juego limpio",
        "concept": "juego_limpio_sin_supervision",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "En un partido escolar, reconocer que se tocó el balón antes de que saliera puede ayudar a tomar una decisión justa, aunque el árbitro no lo haya visto.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La honestidad y el respeto por las reglas ayudan a resolver la jugada con justicia, incluso si el equipo pierde una ventaja.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-026",
        "number": 26,
        "topic": "Bádminton",
        "concept": "objeto_de_juego_badminton",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué objeto golpean los jugadores para pasarlo por encima de la red?",
        "options": [
          "Volante",
          "Disco",
          "Balón ovalado",
          "Pelota de cuero"
        ],
        "correctAnswer": "Volante",
        "explanation": "El bádminton se juega con un volante, también llamado pluma o *shuttlecock*.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-027",
        "number": 27,
        "topic": "Gimnasia",
        "concept": "aparato_barra_equilibrio",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La barra de equilibrio es un aparato de la gimnasia artística.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La barra de equilibrio es uno de los aparatos de la gimnasia artística femenina.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-028",
        "number": 28,
        "topic": "Fútbol",
        "concept": "reanudacion_tiro_esquina",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Si el equipo defensor toca último el balón y este cruza su propia línea de meta sin entrar al arco, ¿qué reanudación corresponde?",
        "options": [
          "Saque de banda",
          "Tiro de esquina",
          "Balón a tierra",
          "Saque inicial"
        ],
        "correctAnswer": "Tiro de esquina",
        "explanation": "Se concede un tiro de esquina al equipo atacante cuando el defensor envía el balón por su propia línea de meta y no se marca gol.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-029",
        "number": 29,
        "topic": "Béisbol",
        "concept": "funcion_lanzador_beisbol",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué jugador lanza la pelota hacia quien está bateando?",
        "options": [
          "Receptor",
          "Jardinero",
          "Lanzador",
          "Corredor"
        ],
        "correctAnswer": "Lanzador",
        "explanation": "El lanzador o *pitcher* envía el lanzamiento al bateador desde el montículo.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-030",
        "number": 30,
        "topic": "Críquet",
        "concept": "objeto_golpeado_en_criquet",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué objeto intenta golpear el bateador con su bate?",
        "options": [
          "Un volante",
          "Una pelota de tenis",
          "Un balón de rugby",
          "Una pelota de críquet"
        ],
        "correctAnswer": "Una pelota de críquet",
        "explanation": "En críquet, el bateador intenta golpear la pelota lanzada por el jugador rival.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-031",
        "number": 31,
        "topic": "Boxeo",
        "concept": "formato_asaltos_boxeo",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se divide normalmente un combate de boxeo?",
        "options": [
          "En asaltos o rounds",
          "En sets",
          "En entradas",
          "En cuartos"
        ],
        "correctAnswer": "En asaltos o rounds",
        "explanation": "Los combates de boxeo se organizan en asaltos, con descansos entre ellos.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-032",
        "number": 32,
        "topic": "Tiro con arco",
        "concept": "puntuacion_centro_diana",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En un blanco de tiro con arco, acertar más cerca del centro suele otorgar más puntos.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "En las dianas convencionales, las zonas más cercanas al centro tienen mayor puntuación.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-033",
        "number": 33,
        "topic": "Natación",
        "concept": "criterio_victoria_carrera_natacion",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué suele determinar quién gana una prueba de natación en piscina?",
        "options": [
          "Quién realiza más vueltas de práctica",
          "Quién completa la distancia en menos tiempo",
          "Quién nada con más salpicaduras",
          "Quién llega primero al punto de partida"
        ],
        "correctAnswer": "Quién completa la distancia en menos tiempo",
        "explanation": "En una carrera de piscina gana quien completa la distancia antes, respetando las reglas de la prueba.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-034",
        "number": 34,
        "topic": "Fútbol",
        "concept": "posicion_adelantada_y_participacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un atacante está en posición adelantada cuando le pasan el balón, pero no lo juega ni afecta a un rival. ¿Qué ocurre necesariamente?",
        "options": [
          "Se concede un penalti",
          "Se repite el pase",
          "Se sanciona si participa activamente en la jugada",
          "Siempre se detiene el juego"
        ],
        "correctAnswer": "Se sanciona si participa activamente en la jugada",
        "explanation": "La posición adelantada no basta por sí sola; se sanciona cuando el jugador participa activamente en la jugada según la regla.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-035",
        "number": 35,
        "topic": "Tenis de mesa",
        "concept": "cierre_juego_tenis_mesa_dos_puntos",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En un juego de tenis de mesa, el marcador llega a 10–10. ¿Qué necesita un jugador para ganarlo?",
        "options": [
          "Llegar primero a 11, aunque el rival tenga 10",
          "Ganar tres puntos seguidos",
          "Llegar a 15 puntos exactos",
          "Obtener dos puntos de ventaja"
        ],
        "correctAnswer": "Obtener dos puntos de ventaja",
        "explanation": "Desde 10–10 se continúa hasta que un jugador aventaje al otro por dos puntos.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-036",
        "number": 36,
        "topic": "Natación",
        "concept": "orden_estilos_medley_individual",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es el orden de estilos en una prueba individual de medley?",
        "options": [
          "Mariposa, espalda, pecho y libre",
          "Espalda, libre, pecho y mariposa",
          "Pecho, mariposa, libre y espalda",
          "Libre, espalda, mariposa y pecho"
        ],
        "correctAnswer": "Mariposa, espalda, pecho y libre",
        "explanation": "En el medley individual, el orden es mariposa, espalda, pecho y libre.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-037",
        "number": 37,
        "topic": "Críquet",
        "concept": "anotar_carrera_criquet",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuándo anotan una carrera los bateadores en críquet?",
        "options": [
          "Cuando ambos dejan caer sus bates",
          "Cuando intercambian extremos y llegan seguros a sus líneas",
          "Cuando la pelota golpea el casco del árbitro",
          "Cuando el lanzador atrapa la pelota"
        ],
        "correctAnswer": "Cuando intercambian extremos y llegan seguros a sus líneas",
        "explanation": "Los bateadores anotan una carrera cuando corren y llegan de forma segura al extremo opuesto.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-038",
        "number": 38,
        "topic": "Atletismo",
        "concept": "contacto_suelo_marcha_atletica",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En la marcha atlética, el atleta no debe perder visiblemente el contacto con el suelo según el criterio arbitral.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "En marcha atlética debe mantenerse contacto visible con el suelo; los jueces evalúan si hay pérdida de contacto.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-039",
        "number": 39,
        "topic": "Balonmano",
        "concept": "lanzamiento_siete_metros",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué lanzamiento se concede normalmente cuando una falta impide una ocasión clara de gol?",
        "options": [
          "Saque de centro",
          "Saque de banda",
          "Lanzamiento de siete metros",
          "Saque de portería"
        ],
        "correctAnswer": "Lanzamiento de siete metros",
        "explanation": "En balonmano, impedir ilegalmente una clara oportunidad de gol puede dar lugar a un lanzamiento de siete metros.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-040",
        "number": 40,
        "topic": "Gimnasia",
        "concept": "errores_ejecucion_gimnasia",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una gimnasta presenta una rutina difícil, pero pierde el equilibrio varias veces. ¿Qué aspecto puede reducir su puntuación?",
        "options": [
          "La cantidad de público",
          "El color de la colchoneta",
          "El orden de salida",
          "Los errores de ejecución"
        ],
        "correctAnswer": "Los errores de ejecución",
        "explanation": "La puntuación considera la ejecución; las pérdidas de equilibrio pueden producir deducciones.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-041",
        "number": 41,
        "topic": "Tenis de mesa",
        "concept": "rebotes_saque_tenis_mesa",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En un saque legal de individuales, ¿dónde debe botar primero la pelota?",
        "options": [
          "En el campo propio y luego en el del rival",
          "Dos veces en el campo rival",
          "Solo fuera del borde de la mesa",
          "Directamente en la mano del rival"
        ],
        "correctAnswer": "En el campo propio y luego en el del rival",
        "explanation": "En individuales, el saque debe botar primero en el lado del servidor y después en el lado del receptor.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-042",
        "number": 42,
        "topic": "Ciclismo",
        "concept": "maillot_amarillo_clasificacion_general",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En el Tour de France, ¿qué indica tradicionalmente el maillot amarillo?",
        "options": [
          "El ganador de una etapa de montaña",
          "El líder de la clasificación general",
          "El ciclista más joven de cada equipo",
          "El ganador del sprint intermedio"
        ],
        "correctAnswer": "El líder de la clasificación general",
        "explanation": "El maillot amarillo distingue al líder de la clasificación general del Tour de France.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-043",
        "number": 43,
        "topic": "Tenis de mesa",
        "concept": "saque_diagonal_dobles_tenis_mesa",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En dobles de tenis de mesa, el saque debe cruzar diagonalmente entre las mitades derechas de ambas personas receptoras.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "En dobles, el servicio va desde la mitad derecha del servidor a la mitad derecha del receptor.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-044",
        "number": 44,
        "topic": "Historia del deporte",
        "concept": "ciudad_juegos_olimpicos_1896",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué ciudad se celebraron los primeros Juegos Olímpicos modernos de 1896?",
        "options": [
          "París",
          "Londres",
          "Atenas",
          "Roma"
        ],
        "correctAnswer": "Atenas",
        "explanation": "Los primeros Juegos Olímpicos de la era moderna se celebraron en Atenas en 1896.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-045",
        "number": 45,
        "topic": "Fútbol sala",
        "concept": "saque_lateral_futbol_sala",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se reanuda normalmente el juego cuando el balón sale por una línea lateral en fútbol sala?",
        "options": [
          "Con un saque de banda con las manos",
          "Con un salto entre dos",
          "Con un saque de esquina automático",
          "Con un saque de banda con el pie"
        ],
        "correctAnswer": "Con un saque de banda con el pie",
        "explanation": "En fútbol sala, el juego se reanuda con un saque lateral ejecutado con el pie.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-046",
        "number": 46,
        "topic": "Baloncesto",
        "concept": "asegurar_rebote_defensivo",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un lanzamiento rival rebota en el aro. ¿Qué acción ayuda a un equipo a recuperar el balón?",
        "options": [
          "Bloquear el paso del rival y asegurar el rebote",
          "Salir del campo antes de que caiga",
          "Esperar a que el balón toque el suelo",
          "Pedir un saque sin disputar el balón"
        ],
        "correctAnswer": "Bloquear el paso del rival y asegurar el rebote",
        "explanation": "Buscar una posición de rebote y controlar el balón permite recuperar la posesión tras un lanzamiento fallido.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-047",
        "number": 47,
        "topic": "Fútbol",
        "concept": "proteger_ventaja_con_equipo_compacto",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un equipo va ganando y el rival presiona con muchos atacantes. ¿Qué ajuste protege mejor la ventaja sin renunciar a jugar?",
        "options": [
          "Dejar libre el centro del campo",
          "Mantener líneas compactas y buscar salidas seguras",
          "Enviar cada balón directamente fuera",
          "Acumular a todos los jugadores junto al arco"
        ],
        "correctAnswer": "Mantener líneas compactas y buscar salidas seguras",
        "explanation": "Un equipo compacto reduce espacios peligrosos y puede aprovechar una salida segura cuando recupera el balón.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-048",
        "number": 48,
        "topic": "Tenis de mesa",
        "concept": "variar_largo_corto_tenis_mesa",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "El rival se aleja de la mesa para responder golpes rápidos. ¿Qué colocación puede obligarlo a cambiar de posición?",
        "options": [
          "Enviar todos los golpes al mismo lugar",
          "Mantener siempre la pelota alta y larga",
          "Jugar una pelota corta cerca de la red",
          "Detener el intercambio"
        ],
        "correctAnswer": "Jugar una pelota corta cerca de la red",
        "explanation": "Una pelota corta puede atraer hacia delante a un rival que espera lejos de la mesa y abrir otros espacios.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-049",
        "number": 49,
        "topic": "Estrategia",
        "concept": "adaptar_estrategia_al_rival",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si una táctica deja de funcionar porque el rival se adaptó, revisar y cambiar el plan puede ser una decisión razonable.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Observar la respuesta del rival y ajustar la estrategia permite buscar nuevas oportunidades durante el juego.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-050",
        "number": 50,
        "topic": "Bádminton",
        "concept": "explotar_espacio_corto_badminton",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "El rival se ubica cerca del fondo de la cancha. ¿Qué golpe puede aprovechar el espacio libre cerca de la red?",
        "options": [
          "Un remate largo hacia el fondo",
          "Un globo alto hacia el fondo",
          "Un saque repetido sin cambiar dirección",
          "Un golpe corto que caiga cerca de la red"
        ],
        "correctAnswer": "Un golpe corto que caiga cerca de la red",
        "explanation": "Un golpe corto puede llevar al rival hacia delante y aprovechar el espacio que dejó cerca de la red.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-051",
        "number": 51,
        "topic": "Voleibol",
        "concept": "inicio_punto_saque_voleibol",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama el golpe que inicia una jugada enviando el balón al campo contrario?",
        "options": [
          "Saque",
          "Bloqueo",
          "Remate",
          "Recepción"
        ],
        "correctAnswer": "Saque",
        "explanation": "El saque pone el balón en juego al comienzo de cada punto.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-052",
        "number": 52,
        "topic": "Atletismo",
        "concept": "testigo_relevo",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En una carrera de relevos, los integrantes deben pasar un testigo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El testigo se entrega entre corredores de un mismo equipo durante la carrera.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-053",
        "number": 53,
        "topic": "Baloncesto",
        "concept": "valor_tiro_libre_baloncesto",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuántos puntos vale un tiro libre convertido?",
        "options": [
          "3",
          "1",
          "2",
          "4"
        ],
        "correctAnswer": "1",
        "explanation": "Cada tiro libre convertido suma un punto.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-054",
        "number": 54,
        "topic": "Tenis",
        "concept": "termino_cero_puntuacion_tenis",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué palabra se usa para indicar cero puntos en el marcador de un juego?",
        "options": [
          "Set",
          "Deuce",
          "Love",
          "Match"
        ],
        "correctAnswer": "Love",
        "explanation": "En la puntuación tradicional del tenis, “love” significa cero.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-055",
        "number": 55,
        "topic": "Ciclismo",
        "concept": "transmision_bicicleta",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué parte de la bicicleta transmite el pedaleo a la rueda trasera mediante la cadena?",
        "options": [
          "Manubrio",
          "Sillín",
          "Freno delantero",
          "Transmisión"
        ],
        "correctAnswer": "Transmisión",
        "explanation": "La transmisión incluye piezas que llevan la fuerza de los pedales hasta la rueda motriz.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-056",
        "number": 56,
        "topic": "Fútbol",
        "concept": "jugadores_equipo_futbol",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuántos jugadores de un equipo están normalmente en la cancha al iniciar un partido, incluido el arquero?",
        "options": [
          "Once",
          "Nueve",
          "Diez",
          "Doce"
        ],
        "correctAnswer": "Once",
        "explanation": "Un equipo de fútbol empieza el partido con once jugadores en el campo.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-057",
        "number": 57,
        "topic": "Deportes",
        "concept": "aro_y_tablero_baloncesto",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En el baloncesto, el aro está unido al tablero.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El aro y la red se fijan a una estructura con tablero en cada extremo de la cancha.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-058",
        "number": 58,
        "topic": "Voleibol",
        "concept": "funcion_libero_voleibol",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué jugador suele especializarse en la defensa y viste una camiseta de color distinto?",
        "options": [
          "Central",
          "Líbero",
          "Opuesto",
          "Colocador"
        ],
        "correctAnswer": "Líbero",
        "explanation": "El líbero es un especialista defensivo identificable por su uniforme contrastante.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-059",
        "number": 59,
        "topic": "Fútbol",
        "concept": "excepcion_fuera_juego_saque_meta",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué un atacante puede quedar habilitado si recibe el balón de un saque de meta?",
        "options": [
          "Porque el saque siempre vale doble",
          "Porque los defensores deben salir del campo",
          "La regla de fuera de juego no se sanciona directamente al recibirlo",
          "Porque el arquero cuenta como dos jugadores"
        ],
        "correctAnswer": "La regla de fuera de juego no se sanciona directamente al recibirlo",
        "explanation": "No se sanciona fuera de juego si el jugador recibe el balón directamente de un saque de meta.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-060",
        "number": 60,
        "topic": "Baloncesto",
        "concept": "violacion_reloj_lanzamiento",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un equipo no lanza al aro dentro del tiempo de posesión. ¿Qué sucede normalmente?",
        "options": [
          "Recibe un tiro libre",
          "Conserva el balón",
          "Se repite el tiempo",
          "Pierde la posesión"
        ],
        "correctAnswer": "Pierde la posesión",
        "explanation": "Agotar el reloj de lanzamiento sin intentar un tiro válido causa un cambio de posesión.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-061",
        "number": 61,
        "topic": "Voleibol",
        "concept": "secuencia_recepcion_colocacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Tras recibir un saque, ¿qué acción suele preparar mejor un ataque organizado?",
        "options": [
          "Un pase hacia quien coloca el balón",
          "Devolverlo con el primer toque siempre",
          "Dejarlo botar en la cancha",
          "Golpearlo con el pie"
        ],
        "correctAnswer": "Un pase hacia quien coloca el balón",
        "explanation": "Una recepción controlada permite que el colocador prepare un ataque para un compañero.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-062",
        "number": 62,
        "topic": "Fútbol",
        "concept": "funcion_tarjeta_amarilla",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué indica el árbitro al mostrar una tarjeta amarilla?",
        "options": [
          "Que el equipo anotó",
          "Una amonestación",
          "Que el jugador fue sustituido",
          "El final del partido"
        ],
        "correctAnswer": "Una amonestación",
        "explanation": "La tarjeta amarilla comunica una amonestación al jugador por una infracción sancionable.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-063",
        "number": 63,
        "topic": "Atletismo",
        "concept": "funcion_carriles_carrera",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una carrera de velocidad con carriles asignados, ¿por qué cada atleta permanece en su carril?",
        "options": [
          "Para correr más distancia",
          "Para evitar la salida de tacos",
          "Para no interferir y respetar la distancia equivalente",
          "Para reducir el número de jueces"
        ],
        "correctAnswer": "Para no interferir y respetar la distancia equivalente",
        "explanation": "Los carriles organizan la carrera y evitan que los atletas se estorben o recorten recorrido.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-064",
        "number": 64,
        "topic": "Ajedrez",
        "concept": "movimiento_salto_caballo_ajedrez",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En ajedrez, el caballo puede saltar por encima de otras piezas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El caballo se desplaza en forma de “L” y es la única pieza que puede saltar sobre piezas interpuestas.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-065",
        "number": 65,
        "topic": "Fútbol",
        "concept": "mano_deliberada_y_sancion_disciplinaria",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un defensor toca deliberadamente el balón con la mano dentro de su propia área y evita una ocasión clara. ¿Qué sanción puede recibir además del penalti?",
        "options": [
          "Un saque de esquina",
          "Un saque de banda",
          "Ninguna tarjeta en ningún caso",
          "Una tarjeta disciplinaria según la infracción"
        ],
        "correctAnswer": "Una tarjeta disciplinaria según la infracción",
        "explanation": "La mano deliberada se sanciona; la tarjeta depende de factores como detener una ocasión manifiesta de gol.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-066",
        "number": 66,
        "topic": "Baloncesto",
        "concept": "diferencia_asistencia_rebote",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué diferencia principal hay entre una asistencia y un rebote?",
        "options": [
          "La asistencia precede a una canasta de compañero; el rebote recupera un tiro fallado",
          "Son dos nombres para un tiro libre",
          "El rebote siempre suma tres puntos",
          "La asistencia solo ocurre en defensa"
        ],
        "correctAnswer": "La asistencia precede a una canasta de compañero; el rebote recupera un tiro fallado",
        "explanation": "Una asistencia contribuye directamente a una canasta; un rebote se obtiene tras un lanzamiento que no entra.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-067",
        "number": 67,
        "topic": "Deportes paralímpicos",
        "concept": "clasificacion_deportiva_especifica",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué la clasificación deportiva puede variar entre disciplinas para una persona con la misma discapacidad?",
        "options": [
          "Cada deporte usa colores distintos",
          "El efecto de la discapacidad se relaciona con las tareas específicas de cada deporte",
          "La clasificación depende de la ciudad sede",
          "Cada atleta elige cualquier clase"
        ],
        "correctAnswer": "El efecto de la discapacidad se relaciona con las tareas específicas de cada deporte",
        "explanation": "La clasificación considera cómo una condición afecta las acciones relevantes en cada deporte.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-068",
        "number": 68,
        "topic": "Fútbol",
        "concept": "funcion_barrera_tiro_libre",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué propósito tiene una barrera defensiva en un tiro libre cercano?",
        "options": [
          "Marcar al arquero propio",
          "Señalar el fuera de juego",
          "Dificultar una trayectoria directa hacia el arco",
          "Impedir que el árbitro vea el balón"
        ],
        "correctAnswer": "Dificultar una trayectoria directa hacia el arco",
        "explanation": "La barrera ocupa parte del ángulo de tiro e intenta bloquear o dificultar el remate directo.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-069",
        "number": 69,
        "topic": "Juegos Olímpicos",
        "concept": "diferencia_programas_olimpicos",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Los Juegos Olímpicos de Invierno y los de Verano incluyen exactamente las mismas disciplinas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Tienen programas deportivos distintos, relacionados en parte con las condiciones de nieve y hielo.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-070",
        "number": 70,
        "topic": "Deportes de combate",
        "concept": "proteccion_rostro_esgrima",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En esgrima, ¿qué equipo protege el rostro del competidor?",
        "options": [
          "Espinillera",
          "Protector bucal únicamente",
          "Rodillera",
          "Máscara"
        ],
        "correctAnswer": "Máscara",
        "explanation": "La máscara es parte del equipo protector usado en esgrima.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-071",
        "number": 71,
        "topic": "Voleibol",
        "concept": "decidir_ataque_con_recepcion_deficiente",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "El equipo recibe el saque, pero el primer pase queda lejos de la red. ¿Qué decisión aumenta la posibilidad de mantener el ataque?",
        "options": [
          "Enviar un balón controlado al campo rival en vez de arriesgar un remate desbalanceado",
          "Golpear a un compañero para reiniciar",
          "Dejar caer el balón y pedir otro saque",
          "Saltar fuera de la cancha con el balón"
        ],
        "correctAnswer": "Enviar un balón controlado al campo rival en vez de arriesgar un remate desbalanceado",
        "explanation": "Si la recepción dificulta una combinación rápida, un envío controlado puede conservar la jugada y evitar un error.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-072",
        "number": 72,
        "topic": "Baloncesto",
        "concept": "elegir_lanzamiento_para_empatar",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Quedan pocos segundos y el equipo va perdiendo por dos puntos. ¿Qué elección puede empatar si se convierte?",
        "options": [
          "Un tiro libre",
          "Un lanzamiento de dos puntos",
          "Un lanzamiento de tres puntos",
          "Un saque lateral"
        ],
        "correctAnswer": "Un lanzamiento de dos puntos",
        "explanation": "Un tiro de dos puntos iguala una diferencia de dos; un triple la superaría.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-073",
        "number": 73,
        "topic": "Fútbol",
        "concept": "aprovechar_amplitud_ante_bloque_central",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un equipo tiene espacio por las bandas porque el rival defiende muy junto por el centro. ¿Qué estrategia aprovecha mejor esa situación?",
        "options": [
          "Reunir a todos los atacantes en el centro",
          "Renunciar a avanzar",
          "Abrir el juego hacia las bandas",
          "Pasar repetidamente al arquero rival"
        ],
        "correctAnswer": "Abrir el juego hacia las bandas",
        "explanation": "Usar las bandas permite atacar los espacios que deja una defensa concentrada en el centro.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-074",
        "number": 74,
        "topic": "",
        "concept": "seguridad_y_juego_limpio_lesion",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si un compañero se lesiona en una jugada y el rival tiene una oportunidad clara, detenerse cuando el árbitro interrumpe el juego respeta las reglas y el cuidado de las personas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La seguridad tiene prioridad cuando el árbitro detiene el partido; el juego debe reanudarse según sus indicaciones.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-075",
        "number": 75,
        "topic": "Atletismo",
        "concept": "tecnica_eficiente_bajo_fatiga",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En una carrera, un atleta empieza a fatigarse y acorta demasiado su zancada. ¿Qué ajuste técnico puede ayudarle a conservar eficiencia sin acelerar de forma brusca?",
        "options": [
          "Mirar al suelo en cada paso",
          "Tensar hombros y puños",
          "Frenar en cada apoyo",
          "Mantener postura erguida y brazos relajados"
        ],
        "correctAnswer": "Mantener postura erguida y brazos relajados",
        "explanation": "Una postura estable y hombros relajados favorecen una técnica eficiente; forzar la velocidad puede aumentar el gasto y desordenar la zancada.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-076",
        "number": 76,
        "topic": "Rugby",
        "concept": "anotacion_ensayo_rugby",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama la acción de apoyar el balón en la zona de marca rival para anotar?",
        "options": [
          "Ensayo",
          "Saque",
          "Bote",
          "Bloqueo"
        ],
        "correctAnswer": "Ensayo",
        "explanation": "En rugby, el ensayo se consigue apoyando el balón en el área de marca del equipo contrario.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-077",
        "number": 77,
        "topic": "Golf",
        "concept": "significado_birdie_golf",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En golf, ¿qué significa hacer un *birdie* en un hoyo?",
        "options": [
          "Completarlo con dos golpes sobre par",
          "Completarlo con un golpe menos que par",
          "No embocar la pelota",
          "Repetir el hoyo"
        ],
        "correctAnswer": "Completarlo con un golpe menos que par",
        "explanation": "Un *birdie* es un resultado de un golpe por debajo del par establecido para ese hoyo.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-078",
        "number": 78,
        "topic": "Triatlón",
        "concept": "orden_disciplinas_triatlon",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En un triatlón estándar, primero se nada, luego se monta en bicicleta y al final se corre.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las disciplinas se realizan en ese orden, con transiciones entre ellas.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-079",
        "number": 79,
        "topic": "Bolos",
        "concept": "strike_bolos_diez_pinos",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En bolos de diez pinos, ¿qué es una chuza o *strike*?",
        "options": [
          "Derribar cinco pinos",
          "Derribar todos en dos turnos",
          "No derribar ninguno",
          "Derribar todos en el primer lanzamiento"
        ],
        "correctAnswer": "Derribar todos en el primer lanzamiento",
        "explanation": "Se consigue un *strike* cuando los diez pinos caen con el primer lanzamiento del turno.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-080",
        "number": 80,
        "topic": "Surf",
        "concept": "superficie_deporte_surf",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Sobre qué se desplaza principalmente un surfista?",
        "options": [
          "Una pista de hielo",
          "Una pared",
          "Una ola",
          "Una cuerda"
        ],
        "correctAnswer": "Una ola",
        "explanation": "En el surf, la persona se mantiene sobre una tabla y aprovecha el movimiento de una ola.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-081",
        "number": 81,
        "topic": "Escalada deportiva",
        "concept": "modalidad_escalada_bloque",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué modalidad de escalada se realiza en muros bajos y normalmente sin cuerda, con colchonetas debajo?",
        "options": [
          "Velocidad",
          "Ciclismo",
          "Descenso",
          "Bloque"
        ],
        "correctAnswer": "Bloque",
        "explanation": "En la modalidad de bloque, las rutas son cortas y se protegen con colchonetas, sin cuerda.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-082",
        "number": 82,
        "topic": "Balonmano",
        "concept": "funcion_arquero_balonmano",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué jugador puede usar las manos para detener un lanzamiento al arco dentro de su área?",
        "options": [
          "El arquero",
          "El extremo rival",
          "El árbitro asistente",
          "El jugador que saca"
        ],
        "correctAnswer": "El arquero",
        "explanation": "El arquero defiende la portería y puede jugar el balón con distintas partes del cuerpo dentro de su área.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-083",
        "number": 83,
        "topic": "Ajedrez",
        "concept": "objetivo_jaque_mate",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En ajedrez, el objetivo es capturar físicamente al rey rival.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La partida termina con jaque mate; el rey no se captura como una pieza ordinaria.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-084",
        "number": 84,
        "topic": "Rugby",
        "concept": "infraccion_pase_adelantado_rugby",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un jugador recibe un pase hacia delante de un compañero. ¿Qué regla general se infringe?",
        "options": [
          "Saque lateral",
          "Pase adelantado",
          "Fuera de juego del arquero",
          "Doble bote"
        ],
        "correctAnswer": "Pase adelantado",
        "explanation": "En rugby, el pase con las manos no debe dirigirse hacia delante; el balón puede avanzarse corriendo o pateando.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-085",
        "number": 85,
        "topic": "Tenis",
        "concept": "condicion_victoria_tiebreak_tenis",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En un desempate tradicional de tenis, ¿qué debe hacer un jugador para ganar, como mínimo?",
        "options": [
          "Ganar cuatro puntos sin perder ninguno",
          "Llegar a cinco puntos exactos",
          "Alcanzar siete puntos con dos de ventaja",
          "Ganar dos juegos seguidos"
        ],
        "correctAnswer": "Alcanzar siete puntos con dos de ventaja",
        "explanation": "El desempate habitual se gana al llegar al menos a siete puntos con una ventaja mínima de dos.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-086",
        "number": 86,
        "topic": "Hockey sobre césped",
        "concept": "causa_concesion_corner_corto_hockey",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué se concede normalmente un córner corto?",
        "options": [
          "Cuando un atacante pide una pausa",
          "Cada vez que el balón toca el palo",
          "Si el arquero despeja al centro",
          "Por ciertas infracciones defensivas dentro del círculo"
        ],
        "correctAnswer": "Por ciertas infracciones defensivas dentro del círculo",
        "explanation": "Un córner corto puede concederse por determinadas faltas defensivas dentro del círculo de tiro o en sus inmediaciones.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-087",
        "number": 87,
        "topic": "Golf",
        "concept": "significado_par_golf",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En golf, el *par* es el número de golpes que se espera que un buen jugador necesite para completar un hoyo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El par es la referencia de golpes asignada al hoyo según su diseño y dificultad.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-088",
        "number": 88,
        "topic": "Escalada deportiva",
        "concept": "criterio_resultado_escalada_velocidad",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una competencia de escalada de velocidad, ¿qué se compara principalmente?",
        "options": [
          "El tiempo que tarda cada atleta en subir una ruta establecida",
          "El número de colores de agarre que toca",
          "La altura de la pared que elige cada atleta",
          "El peso del equipo"
        ],
        "correctAnswer": "El tiempo que tarda cada atleta en subir una ruta establecida",
        "explanation": "En velocidad, el objetivo es completar una ruta estandarizada en el menor tiempo.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-089",
        "number": 89,
        "topic": "Surf",
        "concept": "posicionamiento_toma_ola_surf",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué los surfistas esperan una posición adecuada antes de intentar tomar una ola?",
        "options": [
          "Para que el mar deje de moverse",
          "Para ubicarse donde la ola ofrece una oportunidad segura de recorrido",
          "Para cambiar la dirección del viento",
          "Para evitar usar la tabla"
        ],
        "correctAnswer": "Para ubicarse donde la ola ofrece una oportunidad segura de recorrido",
        "explanation": "La ubicación y el momento ayudan a tomar una ola de manera controlada y aprovechar su recorrido.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-090",
        "number": 90,
        "topic": "Balonmano",
        "concept": "funcion_area_porteria_balonmano",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué limita principalmente la línea del área de portería?",
        "options": [
          "La zona de cambios",
          "El lugar para lanzar penaltis",
          "El espacio reservado al arquero, con restricciones para los jugadores de campo",
          "La mitad del campo"
        ],
        "correctAnswer": "El espacio reservado al arquero, con restricciones para los jugadores de campo",
        "explanation": "El área de portería está destinada al arquero; los jugadores de campo no pueden entrar para obtener ventaja.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-091",
        "number": 91,
        "topic": "Atletismo",
        "concept": "linea_batida_salto_largo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En salto largo, ¿por qué se marca una línea de batida?",
        "options": [
          "Para medir el viento",
          "Para señalar dónde termina la carrera",
          "Para elegir el carril de regreso",
          "Para determinar desde dónde debe despegar legalmente el atleta"
        ],
        "correctAnswer": "Para determinar desde dónde debe despegar legalmente el atleta",
        "explanation": "Si el atleta sobrepasa la línea de batida al despegar, el intento se considera nulo.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-092",
        "number": 92,
        "topic": "Fútbol",
        "concept": "gol_directo_desde_saque_meta",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Se puede anotar directamente en la portería rival desde un saque de meta.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las reglas permiten marcar directamente contra el rival desde un saque de meta.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-093",
        "number": 93,
        "topic": "Bolos",
        "concept": "spare_bolos_diez_pinos",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una persona derriba ocho pinos en el primer lanzamiento y los dos restantes en el segundo. ¿Qué logró en ese turno?",
        "options": [
          "Un *spare*",
          "Un *strike*",
          "Una falta",
          "Un empate"
        ],
        "correctAnswer": "Un *spare*",
        "explanation": "Se obtiene un *spare* al derribar los diez pinos usando los dos lanzamientos del turno.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-094",
        "number": 94,
        "topic": "Curling",
        "concept": "objetivo_de_ubicacion_piedra_curling",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En curling, ¿qué intentan hacer los jugadores con las piedras?",
        "options": [
          "Lanzarlas por encima de una red",
          "Dejarlas lo más cerca posible del centro de la diana",
          "Mantenerlas fuera del hielo",
          "Golpear una pelota en el aire"
        ],
        "correctAnswer": "Dejarlas lo más cerca posible del centro de la diana",
        "explanation": "Los equipos deslizan piedras por el hielo e intentan acercarlas al centro de la zona de puntuación.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-095",
        "number": 95,
        "topic": "Golf",
        "concept": "funcion_caddie_golf",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función cumple un caddie durante una ronda?",
        "options": [
          "Arbitrar todos los golpes",
          "Cambiar el hoyo de lugar",
          "Asistir al jugador, por ejemplo llevando palos y dando consejo permitido",
          "Golpear la pelota por el jugador"
        ],
        "correctAnswer": "Asistir al jugador, por ejemplo llevando palos y dando consejo permitido",
        "explanation": "El caddie puede asistir al jugador dentro de las reglas; no juega los golpes en su lugar.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-096",
        "number": 96,
        "topic": "Bolos",
        "concept": "corregir_alineacion_lanzamiento_bolos",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un jugador derriba pocos pinos porque la bola se desvía hacia el canal. ¿Qué ajuste conviene probar primero?",
        "options": [
          "Soltar la bola desde fuera de la pista",
          "Aumentar la velocidad sin apuntar",
          "Lanzar dos bolas a la vez",
          "Revisar la alineación y dirigir la bola hacia los pinos"
        ],
        "correctAnswer": "Revisar la alineación y dirigir la bola hacia los pinos",
        "explanation": "Alinear el lanzamiento con el objetivo ayuda a controlar la trayectoria antes de cambiar la fuerza.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-097",
        "number": 97,
        "topic": "Rugby",
        "concept": "usar_patada_espacio_rugby",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "El equipo rival defiende cerca de su zona de marca y deja espacio detrás de sus jugadores. ¿Qué opción puede aprovecharlo?",
        "options": [
          "Patear el balón al espacio libre y perseguirlo",
          "Lanzarlo con las manos hacia delante",
          "Salir todos del campo",
          "Dejar el balón inmóvil"
        ],
        "correctAnswer": "Patear el balón al espacio libre y perseguirlo",
        "explanation": "Una patada hacia espacio libre puede superar la línea defensiva; los compañeros pueden avanzar para disputar el balón.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-098",
        "number": 98,
        "topic": "Triatlón",
        "concept": "gestionar_esfuerzo_transicion_triatlon",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una triatleta llega a la transición de ciclismo con las piernas cansadas tras nadar. ¿Qué decisión ayuda a comenzar con control?",
        "options": [
          "Acelerar al máximo antes de montar",
          "Ajustar el equipo con calma y regular el esfuerzo inicial",
          "Saltarse el casco para ahorrar tiempo",
          "Detenerse durante toda la etapa"
        ],
        "correctAnswer": "Ajustar el equipo con calma y regular el esfuerzo inicial",
        "explanation": "Una transición ordenada y un esfuerzo inicial controlado ayudan a mantener seguridad y reservar energía para la prueba.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-099",
        "number": 99,
        "topic": "Juego limpio",
        "concept": "reportar_riesgo_superficie_deportiva",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si una superficie deportiva está mojada y aumenta el riesgo de caída, avisar al árbitro o al entrenador es más seguro que ocultarlo para seguir jugando.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Comunicar un peligro permite que las personas responsables evalúen la situación y reduzcan el riesgo de lesión.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-100",
        "number": 100,
        "topic": "Escalada deportiva",
        "concept": "ajustar_apoyos_para_alcance_escalada",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una escaladora no alcanza el siguiente agarre desde una postura estirada. ¿Qué estrategia puede mejorar su alcance sin saltar de inmediato?",
        "options": [
          "Soltar ambas manos a la vez",
          "Empujar la pared con la cabeza",
          "Reubicar los pies y acercar el cuerpo a la pared",
          "Mirar solo hacia abajo"
        ],
        "correctAnswer": "Reubicar los pies y acercar el cuerpo a la pared",
        "explanation": "Cambiar apoyos y acercar el centro del cuerpo puede mejorar el equilibrio y permitir alcanzar el siguiente agarre con control.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-101",
        "number": 101,
        "topic": "Remo",
        "concept": "implemento_propulsion_remo",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Con qué implementos impulsa una embarcación un remero?",
        "options": [
          "Remos",
          "Raquetas",
          "Bastones de esquí",
          "Aros"
        ],
        "correctAnswer": "Remos",
        "explanation": "Los remos permiten empujar el agua e impulsar la embarcación.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-102",
        "number": 102,
        "topic": "Bádminton",
        "concept": "puntaje_objetivo_juego_badminton",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En un juego estándar de bádminton, ¿a cuántos puntos se juega normalmente cada set?",
        "options": [
          "15",
          "21",
          "25",
          "30"
        ],
        "correctAnswer": "21",
        "explanation": "Un juego suele ganarse al llegar primero a 21 puntos, con la ventaja requerida por el reglamento.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-103",
        "number": 103,
        "topic": "Béisbol",
        "concept": "strikes_para_ponche_beisbol",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuántos *strikes* suelen completar un turno al bate y dejar al bateador eliminado?",
        "options": [
          "Dos",
          "Cuatro",
          "Tres",
          "Cinco"
        ],
        "correctAnswer": "Tres",
        "explanation": "Con tres strikes, el bateador normalmente queda ponchado, sujeto a situaciones específicas de la regla.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-104",
        "number": 104,
        "topic": "Esquí alpino",
        "concept": "puertas_recorrido_eslalon",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué debe hacer un esquiador en una carrera de eslalon?",
        "options": [
          "Saltar sobre una red",
          "Lanzar una piedra",
          "Remar hasta una boya",
          "Pasar entre puertas del recorrido"
        ],
        "correctAnswer": "Pasar entre puertas del recorrido",
        "explanation": "En el eslalon, los esquiadores descienden entre puertas dispuestas a lo largo del trayecto.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-105",
        "number": 105,
        "topic": "Voleibol playa",
        "concept": "jugadores_equipo_voleibol_playa",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuántos jugadores por equipo están en la cancha en el voleibol de playa tradicional?",
        "options": [
          "Dos",
          "Cuatro",
          "Seis",
          "Cinco"
        ],
        "correctAnswer": "Dos",
        "explanation": "El voleibol de playa tradicional se juega con dos integrantes por equipo en la cancha.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-106",
        "number": 106,
        "topic": "Críquet",
        "concept": "objetivo_lanzamiento_criquet",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué estructura intenta derribar el lanzador al enviar la pelota hacia el bateador?",
        "options": [
          "La red",
          "Los palos o *wickets*",
          "La línea de meta",
          "El tablero"
        ],
        "correctAnswer": "Los palos o *wickets*",
        "explanation": "El lanzador intenta golpear los palos; el bateador los protege con su bate.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-107",
        "number": 107,
        "topic": "Patinaje artístico",
        "concept": "superficie_y_elementos_patinaje_artistico",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En patinaje artístico, los deportistas realizan movimientos sobre patines de hielo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Las rutinas se ejecutan sobre hielo e incluyen elementos como giros, saltos y secuencias de pasos.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-108",
        "number": 108,
        "topic": "Fútbol americano",
        "concept": "valor_touchdown_futbol_americano",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuántos puntos vale un *touchdown*?",
        "options": [
          "Tres",
          "Cuatro",
          "Seis",
          "Siete"
        ],
        "correctAnswer": "Seis",
        "explanation": "Un *touchdown* vale seis puntos; después, el equipo puede intentar una conversión.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-109",
        "number": 109,
        "topic": "Tenis de mesa",
        "concept": "repeticion_saque_neto_tenis_mesa",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Si un saque toca la red y luego cae correctamente en el campo del receptor, normalmente se repite el saque.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Ese servicio se considera *let*: no cuenta como falta y debe repetirse.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-110",
        "number": 110,
        "topic": "Remo",
        "concept": "sincronizacion_fuerza_equipo_remo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué un equipo de remo sincroniza la entrada de sus remos al agua?",
        "options": [
          "Para cambiar el número de integrantes",
          "Para evitar que la embarcación flote",
          "Para girar los asientos hacia la meta",
          "Para coordinar la fuerza y avanzar con estabilidad"
        ],
        "correctAnswer": "Para coordinar la fuerza y avanzar con estabilidad",
        "explanation": "Coordinar el ritmo ayuda a aplicar la fuerza de manera conjunta y mantener la embarcación equilibrada.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-111",
        "number": 111,
        "topic": "Baloncesto",
        "concept": "violacion_pasos_baloncesto",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un jugador corre con el balón sin botarlo ni pasarlo. ¿Qué infracción comete?",
        "options": [
          "Falta técnica siempre",
          "Saque de esquina",
          "Pasos",
          "Fuera de juego"
        ],
        "correctAnswer": "Pasos",
        "explanation": "Avanzar con el balón sin driblar dentro de los límites permitidos constituye una violación de pasos.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-112",
        "number": 112,
        "topic": "Tenis",
        "concept": "efecto_superficie_arcilla_tenis",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué un intercambio suele ser distinto en una cancha de arcilla que en una de césped?",
        "options": [
          "La pelota puede rebotar más lento y alto en arcilla",
          "En arcilla no se usa raqueta",
          "El césped elimina el saque",
          "La red cambia de altura en cada punto"
        ],
        "correctAnswer": "La pelota puede rebotar más lento y alto en arcilla",
        "explanation": "La superficie influye en el rebote y la velocidad de la pelota; la arcilla suele enlentecer el juego.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-113",
        "number": 113,
        "topic": "Fútbol",
        "concept": "ubicacion_tanda_penaltis",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una tanda de penaltis para decidir un partido, ¿desde dónde se ejecutan los tiros?",
        "options": [
          "Desde la línea de medio campo",
          "Desde la línea lateral",
          "Desde el área pequeña",
          "Desde el punto penal"
        ],
        "correctAnswer": "Desde el punto penal",
        "explanation": "Los tiros de la tanda se realizan desde el punto penal, frente al arquero.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-114",
        "number": 114,
        "topic": "Patinaje artístico",
        "concept": "componentes_rutina_patinaje_artistico",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué se combinan saltos, giros y pasos en una rutina?",
        "options": [
          "Para cambiar la superficie del hielo",
          "Para demostrar habilidades técnicas y artísticas",
          "Para evitar que el público vea el recorrido",
          "Para detener el cronómetro"
        ],
        "correctAnswer": "Para demostrar habilidades técnicas y artísticas",
        "explanation": "Las rutinas muestran control técnico y expresión mediante distintos elementos del patinaje.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-115",
        "number": 115,
        "topic": "Voleibol playa",
        "concept": "reparto_cobertura_voleibol_playa",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En voleibol de playa, comunicarse para acordar quién cubrirá cada zona ayuda a reducir espacios sin defensa.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Como cada equipo tiene dos jugadores en cancha, coordinar responsabilidades facilita cubrir mejor el espacio.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-116",
        "number": 116,
        "topic": "Ciclismo",
        "concept": "formato_contrarreloj_individual",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una contrarreloj individual, ¿cómo compiten normalmente los ciclistas?",
        "options": [
          "Cada uno intenta completar el recorrido en el menor tiempo",
          "Todos parten juntos en un pelotón",
          "Gana quien consiga más puntos de sprint",
          "Se turnan para empujar una bicicleta"
        ],
        "correctAnswer": "Cada uno intenta completar el recorrido en el menor tiempo",
        "explanation": "En una contrarreloj individual, cada participante compite contra el reloj en su recorrido.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-117",
        "number": 117,
        "topic": "Tiro deportivo",
        "concept": "factores_precision_tiro_deportivo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ayuda a un tirador a mejorar la precisión en una competencia de tiro?",
        "options": [
          "Mover el blanco durante el disparo",
          "Controlar postura, respiración y alineación",
          "Disparar antes de apuntar",
          "Cambiar de distancia sin autorización"
        ],
        "correctAnswer": "Controlar postura, respiración y alineación",
        "explanation": "Una postura estable, respiración controlada y buena alineación ayudan a dirigir el disparo con precisión.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-118",
        "number": 118,
        "topic": "Surf",
        "concept": "criterios_evaluacion_ola_surf",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una competencia, ¿qué suelen valorar los jueces al puntuar una ola?",
        "options": [
          "El color de la tabla únicamente",
          "La cantidad de espectadores",
          "Las maniobras y el control mostrados en la ola",
          "El tiempo que el surfista esperó antes"
        ],
        "correctAnswer": "Las maniobras y el control mostrados en la ola",
        "explanation": "La puntuación considera la calidad de las maniobras, el control y cómo se aprovecha la ola según los criterios de la competencia.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-119",
        "number": 119,
        "topic": "Béisbol",
        "concept": "pelota_foul_beisbol",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un bateador conecta una pelota que sale del campo por una zona lateral no válida como jonrón. ¿Qué puede señalar el árbitro?",
        "options": [
          "Un *touchdown*",
          "Un penalti",
          "Un *spare*",
          "Una pelota de foul"
        ],
        "correctAnswer": "Una pelota de foul",
        "explanation": "Una pelota bateada fuera del territorio válido puede ser foul, según su trayectoria y dónde toque.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-120",
        "number": 120,
        "topic": "Esquí alpino",
        "concept": "omision_puerta_eslalon",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En una competencia de eslalon, saltarse una puerta del recorrido puede invalidar la bajada.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El esquiador debe seguir el trazado y pasar correctamente por las puertas establecidas.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-121",
        "number": 121,
        "topic": "Tenis",
        "concept": "variar_trayectoria_para_desestabilizar_tenis",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una jugadora enfrenta un rival que devuelve bien los golpes altos y profundos. ¿Qué cambio podría alterar su ritmo?",
        "options": [
          "Alternar alturas y direcciones con intención",
          "Repetir todos los golpes al mismo lugar",
          "Golpear siempre fuera de la cancha",
          "Dejar de moverse"
        ],
        "correctAnswer": "Alternar alturas y direcciones con intención",
        "explanation": "Variar altura y dirección obliga al rival a ajustar su posición y puede abrir espacios para el siguiente golpe.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-122",
        "number": 122,
        "topic": "Remo",
        "concept": "corregir_desvio_embarcacion_remo",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una embarcación se desvía hacia un lado aunque los remeros aplican mucha fuerza. ¿Qué conviene revisar primero?",
        "options": [
          "El color de los remos",
          "La sincronización y equilibrio de las paladas",
          "El número de espectadores",
          "La meta de otra embarcación"
        ],
        "correctAnswer": "La sincronización y equilibrio de las paladas",
        "explanation": "Paladas descoordinadas o desequilibradas pueden hacer que la embarcación pierda dirección, aunque se aplique fuerza.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-123",
        "number": 123,
        "topic": "Fútbol americano",
        "concept": "elegir_carrera_para_ganar_pocas_yardas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "El equipo necesita avanzar una distancia corta y conserva varios intentos. ¿Qué jugada suele reducir el riesgo de un pase largo incompleto?",
        "options": [
          "Patear el balón hacia su propia zona",
          "Dejar que corra el reloj fuera del campo",
          "Entregar el balón a un corredor para ganar terreno",
          "Lanzar siempre a la zona más lejana"
        ],
        "correctAnswer": "Entregar el balón a un corredor para ganar terreno",
        "explanation": "Una jugada terrestre puede ser adecuada para ganar pocas yardas con control, aunque la decisión depende de la defensa y la situación.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-124",
        "number": 124,
        "topic": "Deportes de equipo",
        "concept": "repliegue_tras_perder_posesion",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Un equipo que pierde la posesión puede replegarse para proteger su zona antes de intentar recuperar el balón.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Replegarse puede reducir los espacios disponibles para el rival y ayudar a organizar la defensa.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-125",
        "number": 125,
        "topic": "Ciclismo",
        "concept": "tomar_curva_mojada_con_control",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En una curva mojada, ¿qué decisión prioriza el control y la seguridad?",
        "options": [
          "Frenar bruscamente mientras se inclina al máximo",
          "Soltar el manubrio",
          "Acelerar de golpe sobre la pintura",
          "Reducir la velocidad antes de la curva y trazarla con suavidad"
        ],
        "correctAnswer": "Reducir la velocidad antes de la curva y trazarla con suavidad",
        "explanation": "Reducir la velocidad antes de girar y evitar movimientos bruscos ayuda a conservar agarre en una superficie mojada.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-126",
        "number": 126,
        "topic": "Boccia",
        "concept": "objetivo_bola_boccia",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En boccia, ¿hacia qué objeto intentan acercar sus bolas los jugadores?",
        "options": [
          "Una bola objetivo",
          "Una canasta",
          "Un aro colgante",
          "Una portería"
        ],
        "correctAnswer": "Una bola objetivo",
        "explanation": "Cada lanzamiento busca dejar la bola propia más cerca de la bola objetivo que las del rival.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-127",
        "number": 127,
        "topic": "Rugby",
        "concept": "conversion_tras_ensayo_rugby",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Después de marcar un ensayo, ¿qué oportunidad tiene normalmente el equipo anotador?",
        "options": [
          "Lanzar un penalti de fútbol",
          "Intentar una conversión a los palos",
          "Cobrar un tiro de esquina",
          "Cambiar a todos sus jugadores"
        ],
        "correctAnswer": "Intentar una conversión a los palos",
        "explanation": "Tras un ensayo, el equipo puede patear una conversión para sumar puntos adicionales.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-128",
        "number": 128,
        "topic": "Automovilismo",
        "concept": "cambio_neumaticos_parada_boxes",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Durante una parada en boxes, un equipo puede cambiar los neumáticos del automóvil.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "En una parada, el equipo puede realizar tareas como cambiar neumáticos según las reglas de la competencia.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-129",
        "number": 129,
        "topic": "Atletismo",
        "concept": "implemento_lanzamiento_bala",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En lanzamiento de bala, ¿qué implemento impulsa el atleta?",
        "options": [
          "Un disco liviano",
          "Una jabalina flexible",
          "Una esfera metálica",
          "Un balón medicinal"
        ],
        "correctAnswer": "Una esfera metálica",
        "explanation": "La bala es una esfera metálica que se impulsa desde el hombro, dentro de un círculo de lanzamiento.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-130",
        "number": 130,
        "topic": "Atletismo",
        "concept": "distancia_oficial_maraton",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es la distancia oficial de un maratón?",
        "options": [
          "40 km",
          "41 km",
          "43 km",
          "42,195 km"
        ],
        "correctAnswer": "42,195 km",
        "explanation": "La distancia reglamentaria del maratón es de 42 kilómetros y 195 metros.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-131",
        "number": 131,
        "topic": "Golf",
        "concept": "palo_putter_en_green",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué palo se usa principalmente para hacer rodar la bola hacia el hoyo sobre el green?",
        "options": [
          "Putter",
          "Madera de salida",
          "Hierro largo",
          "Wedge de arena"
        ],
        "correctAnswer": "Putter",
        "explanation": "El putter está diseñado principalmente para golpes rodados y controlados sobre el green.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-132",
        "number": 132,
        "topic": "Piragüismo",
        "concept": "recorrido_puertas_piraguismo_eslalon",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En piragüismo de eslalon, ¿qué debe hacer el deportista durante el recorrido?",
        "options": [
          "Pasar una pelota entre compañeros",
          "Navegar por puertas señaladas en el agua",
          "Saltar sobre una barra",
          "Derribar conos con un balón"
        ],
        "correctAnswer": "Navegar por puertas señaladas en el agua",
        "explanation": "El palista recorre un canal y debe pasar por una secuencia de puertas sin omitirlas ni tocarlas indebidamente.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-133",
        "number": 133,
        "topic": "Tenis",
        "concept": "pasillos_laterales_cancha_dobles",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En dobles, las líneas laterales exteriores forman parte del ancho de la cancha.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "En dobles se utilizan los pasillos laterales; en individuales, esos pasillos quedan fuera.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-134",
        "number": 134,
        "topic": "Esgrima",
        "concept": "blanco_valido_florete",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En esgrima con florete, ¿qué zona cuenta como blanco válido?",
        "options": [
          "Solo las piernas",
          "La espalda y la cabeza",
          "El torso",
          "Todo el cuerpo sin excepción"
        ],
        "correctAnswer": "El torso",
        "explanation": "En florete, el blanco válido se limita al torso; otras armas tienen zonas válidas diferentes.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-135",
        "number": 135,
        "topic": "Ajedrez",
        "concept": "piezas_movimiento_enroque",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué dos piezas se mueven al realizar el enroque?",
        "options": [
          "Reina y alfil",
          "Caballo y torre",
          "Rey y reina",
          "Rey y torre"
        ],
        "correctAnswer": "Rey y torre",
        "explanation": "El enroque mueve el rey dos casillas hacia una torre y coloca esa torre al otro lado del rey, si se cumplen las condiciones.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-136",
        "number": 136,
        "topic": "Remo",
        "concept": "orientacion_remeros_en_embarcacion",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En una embarcación de remo, muchos remeros avanzan sentados mirando hacia la popa mientras impulsan la embarcación.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La posición habitual de remo mira hacia la popa, en sentido contrario al avance de la embarcación.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-137",
        "number": 137,
        "topic": "Automovilismo",
        "concept": "senal_bandera_amarilla_motorsport",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una carrera, ¿qué indica normalmente una bandera amarilla?",
        "options": [
          "Peligro en la pista: reducir la velocidad y estar preparado para detenerse",
          "Fin de la competencia",
          "Vuelta más rápida",
          "Entrada obligatoria a boxes"
        ],
        "correctAnswer": "Peligro en la pista: reducir la velocidad y estar preparado para detenerse",
        "explanation": "La bandera amarilla advierte un peligro y exige precaución; las restricciones concretas dependen del reglamento de la serie.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-138",
        "number": 138,
        "topic": "Béisbol",
        "concept": "atrapada_de_aire_bateador_beisbol",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un bateador golpea una pelota que un defensor atrapa en el aire antes de que toque el suelo. ¿Qué sucede normalmente?",
        "options": [
          "El bateador obtiene una carrera",
          "El bateador queda eliminado",
          "El bateador recibe tres bases",
          "Se repite automáticamente el lanzamiento"
        ],
        "correctAnswer": "El bateador queda eliminado",
        "explanation": "Una pelota bateada atrapada de aire antes de tocar el suelo produce un *out* del bateador.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-139",
        "number": 139,
        "topic": "Natación",
        "concept": "salida_prueba_espalda_natacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Desde dónde comienza normalmente una prueba de espalda?",
        "options": [
          "Sentado en una silla al borde",
          "Corriendo desde la playa",
          "En el agua, sujetándose al soporte de salida",
          "Saltando desde el fondo de la piscina"
        ],
        "correctAnswer": "En el agua, sujetándose al soporte de salida",
        "explanation": "En espalda, los nadadores comienzan en el agua y se sujetan a las agarraderas de salida.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-140",
        "number": 140,
        "topic": "Hockey sobre hielo",
        "concept": "objetivo_juego_hockey_hielo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué intenta hacer principalmente el equipo atacante en hockey sobre hielo?",
        "options": [
          "Introducir una pelota en un aro",
          "Derribar una torre de pinos",
          "Pasar una pluma sobre la red",
          "Enviar el disco a la portería rival"
        ],
        "correctAnswer": "Enviar el disco a la portería rival",
        "explanation": "Los jugadores usan bastones para mover el disco e intentar marcar en la portería contraria.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-141",
        "number": 141,
        "topic": "Voleibol",
        "concept": "balon_toca_red_y_cruza_voleibol",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Si el balón toca la red y aun así cruza legalmente al campo rival, el intercambio puede continuar.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El contacto con la red no detiene automáticamente la jugada si el balón cruza dentro del espacio permitido.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-142",
        "number": 142,
        "topic": "Rugby",
        "concept": "habilitacion_companero_adelantado_tras_patada_rugby",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un jugador patea hacia delante y un compañero que estaba delante del pateador quiere disputar la pelota. ¿Qué debe hacer para quedar habilitado?",
        "options": [
          "Retirarse detrás de un compañero habilitado o hasta la línea de 10 metros aplicable",
          "Levantar una mano",
          "Cruzar la línea lateral",
          "Recibir un pase hacia delante"
        ],
        "correctAnswer": "Retirarse detrás de un compañero habilitado o hasta la línea de 10 metros aplicable",
        "explanation": "Tras una patada, quien estaba delante debe retirarse y no intervenir hasta cumplir la regla de habilitación correspondiente.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-143",
        "number": 143,
        "topic": "Esquí de fondo",
        "concept": "huellas_paralelas_esqui_clasico",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En la técnica clásica, ¿cómo avanzan normalmente los esquís?",
        "options": [
          "Cruzados en cada paso",
          "Deslizándose en dos huellas paralelas",
          "Girando alrededor de una boya",
          "Saltando entre puertas de eslalon"
        ],
        "correctAnswer": "Deslizándose en dos huellas paralelas",
        "explanation": "La técnica clásica suele utilizar huellas paralelas; el estilo libre permite una acción de patinaje más abierta.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-144",
        "number": 144,
        "topic": "Automovilismo",
        "concept": "elegir_neumatico_segun_condicion_pista",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué un piloto puede cambiar el tipo de neumático cuando la pista pasa de seca a mojada?",
        "options": [
          "Para aumentar la altura del alerón",
          "Para cambiar el número de vueltas",
          "Para mejorar el agarre en las condiciones de la pista",
          "Para evitar que funcione el freno"
        ],
        "correctAnswer": "Para mejorar el agarre en las condiciones de la pista",
        "explanation": "Los neumáticos adecuados a la lluvia evacuan agua y ayudan a mantener agarre en una pista mojada.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-145",
        "number": 145,
        "topic": "Natación",
        "concept": "posicion_cuerpo_estilo_espalda",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué estilo de natación se caracteriza por nadar boca arriba durante la prueba?",
        "options": [
          "Mariposa",
          "Pecho",
          "Libre",
          "Espalda"
        ],
        "correctAnswer": "Espalda",
        "explanation": "En el estilo espalda, el nadador permanece orientado boca arriba durante la prueba, con reglas específicas de salida y viraje.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-146",
        "number": 146,
        "topic": "Ajedrez",
        "concept": "tenedor_ataque_doble_ajedrez",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una pieza rival está atacando al rey y a la reina al mismo tiempo. ¿Qué amenaza táctica está usando?",
        "options": [
          "Un tenedor",
          "Un enroque",
          "Un empate por repetición",
          "Una coronación"
        ],
        "correctAnswer": "Un tenedor",
        "explanation": "Un tenedor ataca dos o más piezas a la vez y obliga al rival a decidir cuál defender.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-147",
        "number": 147,
        "topic": "Piragüismo",
        "concept": "ajustar_trayectoria_antes_puerta_eslalon",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un palista se acerca a una puerta de eslalon desde un ángulo que dificulta pasarla sin tocarla. ¿Qué ajuste puede ayudar?",
        "options": [
          "Acelerar sin cambiar la trayectoria",
          "Corregir el ángulo antes de llegar y orientar la embarcación hacia la puerta",
          "Dejar de remar hasta que la corriente lo lleve",
          "Pasar por fuera de la puerta"
        ],
        "correctAnswer": "Corregir el ángulo antes de llegar y orientar la embarcación hacia la puerta",
        "explanation": "Preparar el ángulo antes de la puerta permite controlar mejor la trayectoria y reducir el riesgo de tocarla u omitirla.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-148",
        "number": 148,
        "topic": "Baloncesto",
        "concept": "aprovechar_superioridad_numerica_contraataque",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En un contraataque de baloncesto, dos atacantes avanzan contra un solo defensor. ¿Qué decisión puede crear un tiro más claro?",
        "options": [
          "Lanzar desde lejos con el defensor encima",
          "Detenerse y esperar al equipo rival",
          "Pasar al compañero libre cuando el defensor se compromete",
          "Botar hacia la línea lateral"
        ],
        "correctAnswer": "Pasar al compañero libre cuando el defensor se compromete",
        "explanation": "Si el defensor se compromete con quien lleva el balón, un pase oportuno puede dejar libre al compañero.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-149",
        "number": 149,
        "topic": "Juego limpio",
        "concept": "reconocer_ultimo_contacto_juego_limpio",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "En un partido sin árbitros asistentes, si una jugadora reconoce que tocó el balón por última vez antes de que saliera, admitirlo puede ayudar a reanudar el juego con justicia.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Reconocer el último contacto contribuye a una decisión justa y demuestra respeto por el juego.",
        "stability": "STABLE"
      },
      {
        "id": "DEP6-150",
        "number": 150,
        "topic": "Golf",
        "concept": "decidir_golpe_seguro_ante_obstaculo_golf",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En un hoyo con un obstáculo de agua entre la bola y el green, ¿qué decisión prioriza una jugada segura si el jugador no domina un golpe largo?",
        "options": [
          "Golpear con máxima fuerza sin apuntar",
          "Lanzar la bola con la mano",
          "Ignorar el obstáculo y caminar al green",
          "Elegir un golpe controlado que deje la bola antes del obstáculo"
        ],
        "correctAnswer": "Elegir un golpe controlado que deje la bola antes del obstáculo",
        "explanation": "Un golpe controlado que evite el riesgo puede ser mejor que intentar una distancia que el jugador no domina.",
        "stability": "STABLE"
      }
    ]
  },
  {
    "catalogId": "edusyn-ciencia-naturaleza-grade-6-v1",
    "title": "Ciencia y naturaleza · 6.º",
    "grade": 6,
    "subjectArea": "Duelos",
    "category": "Ciencia y naturaleza",
    "version": "1.0",
    "availability": "institution-opt-in",
    "editorialStatus": "ready-for-import",
    "audit": {
      "questions": 150,
      "multipleChoice": 120,
      "trueFalse": 30,
      "difficulty": {
        "basic": 50,
        "intermediate": 70,
        "application": 30
      },
      "answerPositions": {
        "A": 30,
        "B": 30,
        "C": 30,
        "D": 30
      },
      "conceptsPresent": 150,
      "conceptsMissing": 0
    },
    "sources": [
      "https://science.nasa.gov/moon/moon-phases/",
      "https://science.nasa.gov/moon/tides/",
      "https://science.nasa.gov/earth/earth-observatory/ozone/",
      "https://science.nasa.gov/solar-system/solar-system-facts/",
      "https://www.noaa.gov/education/resource-collections/freshwater/water-cycle",
      "https://www.noaa.gov/education/resource-collections/weather-atmosphere",
      "https://openstax.org/details/books/biology-2e",
      "https://openstax.org/books/biology-2e/pages/46-1-ecology-of-ecosystems",
      "https://openstax.org/books/biology-2e/pages/19-3-adaptive-evolution",
      "https://pubs.usgs.gov/gip/collect1/collectgip.html",
      "https://www.usgs.gov/programs/earthquake-hazards/science-earthquakes"
    ],
    "questions": [
      {
        "id": "CIE6-001",
        "number": 1,
        "topic": "Biología",
        "concept": "celula_unidad_basica_vida",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es la unidad básica que forma a los seres vivos?",
        "options": [
          "La célula",
          "El órgano",
          "El tejido",
          "El sistema"
        ],
        "correctAnswer": "La célula",
        "explanation": "Todos los seres vivos están formados por una o más células, que realizan funciones vitales.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-002",
        "number": 2,
        "topic": "Materia",
        "concept": "materia_masa_y_espacio",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La materia tiene masa y ocupa espacio.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Estas dos propiedades permiten distinguir la materia de otras formas de energía.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-003",
        "number": 3,
        "topic": "Biología",
        "concept": "funcion_raiz_planta",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función cumple principalmente la raíz de una planta?",
        "options": [
          "Producir semillas",
          "Absorber agua y sujetar la planta",
          "Atraer insectos con colores",
          "Fabricar frutos"
        ],
        "correctAnswer": "Absorber agua y sujetar la planta",
        "explanation": "Las raíces absorben agua y minerales del suelo y ayudan a fijar la planta.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-004",
        "number": 4,
        "topic": "Investigación científica",
        "concept": "distinguir_observacion_cientifica",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una estudiante ve gotas en una hoja y las dibuja en su cuaderno. ¿Qué hizo principalmente?",
        "options": [
          "Una predicción",
          "Una conclusión",
          "Una observación",
          "Una explicación causal"
        ],
        "correctAnswer": "Una observación",
        "explanation": "Describir o registrar lo que percibe directamente es una observación.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-005",
        "number": 5,
        "topic": "Ecosistemas",
        "concept": "productor_fotosintetico",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué organismo produce su propio alimento usando luz solar?",
        "options": [
          "El hongo",
          "El conejo",
          "El águila",
          "La planta"
        ],
        "correctAnswer": "La planta",
        "explanation": "Las plantas son productores porque fabrican alimento mediante la fotosíntesis.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-006",
        "number": 6,
        "topic": "Ciclo del agua",
        "concept": "evaporacion_charco",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Un charco desaparece después de varias horas cálidas y soleadas. ¿Qué proceso ocurrió principalmente?",
        "options": [
          "Evaporación",
          "Condensación",
          "Congelación",
          "Precipitación"
        ],
        "correctAnswer": "Evaporación",
        "explanation": "El calor aporta energía para que parte del agua líquida pase al aire como vapor.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-007",
        "number": 7,
        "topic": "Materia",
        "concept": "punto_congelacion_agua_pura",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "A presión normal, el agua pura se congela cerca de 0 °C.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El punto de congelación del agua pura a presión atmosférica normal es aproximadamente 0 °C.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-008",
        "number": 8,
        "topic": "Tierra y espacio",
        "concept": "rotacion_y_dia_noche",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué movimiento de la Tierra produce la alternancia entre día y noche?",
        "options": [
          "Traslación alrededor del Sol",
          "Rotación sobre su eje",
          "Inclinación de la Luna",
          "Cambio de estaciones"
        ],
        "correctAnswer": "Rotación sobre su eje",
        "explanation": "Al rotar, distintas partes de la Tierra quedan orientadas hacia el Sol o alejadas de él.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-009",
        "number": 9,
        "topic": "Ciclo del agua",
        "concept": "condensacion_formacion_nubes",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Cuando el vapor de agua se enfría y forma pequeñas gotas en una nube, ocurre:",
        "options": [
          "Fusión",
          "Evaporación",
          "Condensación",
          "Escorrentía"
        ],
        "correctAnswer": "Condensación",
        "explanation": "En la condensación, el vapor pierde energía y pasa a formar gotas líquidas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-010",
        "number": 10,
        "topic": "Hongos",
        "concept": "reino_hongos_distinto_plantas",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Los hongos son plantas porque no se desplazan de un lugar a otro.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Los hongos pertenecen a un reino distinto; obtienen nutrientes de otros organismos o de materia orgánica.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-011",
        "number": 11,
        "topic": "Física",
        "concept": "instrumento_medir_temperatura",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué mide directamente un termómetro?",
        "options": [
          "La masa",
          "El volumen",
          "La presión",
          "La temperatura"
        ],
        "correctAnswer": "La temperatura",
        "explanation": "El termómetro indica la temperatura de un objeto o del entorno.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-012",
        "number": 12,
        "topic": "Materia",
        "concept": "mezcla_sin_reaccion_quimica",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Se mezclan arena y limaduras de hierro sin transformar sus materiales. ¿Qué se formó?",
        "options": [
          "Una mezcla",
          "Un elemento nuevo",
          "Un gas puro",
          "Un compuesto químico"
        ],
        "correctAnswer": "Una mezcla",
        "explanation": "En una mezcla, las sustancias se combinan físicamente y conservan sus propiedades.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-013",
        "number": 13,
        "topic": "Ecosistemas",
        "concept": "flujo_energia_cadena_alimentaria",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En la cadena pasto → saltamontes → rana, ¿hacia dónde fluye la energía?",
        "options": [
          "De la rana al pasto",
          "Del pasto al saltamontes y a la rana",
          "Del saltamontes al pasto y a la rana",
          "Solo hacia el pasto"
        ],
        "correctAnswer": "Del pasto al saltamontes y a la rana",
        "explanation": "Las flechas muestran el paso de energía desde el organismo que sirve de alimento hacia quien lo consume.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-014",
        "number": 14,
        "topic": "Fuerzas",
        "concept": "friccion_opone_deslizamiento",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un libro se desliza sobre una mesa áspera y pierde velocidad. ¿Qué fuerza se opone al movimiento?",
        "options": [
          "Magnetismo",
          "Flotación",
          "Fricción",
          "Luz"
        ],
        "correctAnswer": "Fricción",
        "explanation": "La fricción entre las superficies se opone al deslizamiento y puede reducir la velocidad.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-015",
        "number": 15,
        "topic": "Geología",
        "concept": "diferencia_meteorizacion_erosion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una roca se rompe en fragmentos pequeños sin que estos sean transportados lejos. ¿Qué proceso predomina?",
        "options": [
          "Erosión",
          "Sedimentación",
          "Fusión",
          "Meteorización"
        ],
        "correctAnswer": "Meteorización",
        "explanation": "La meteorización descompone rocas en el lugar; la erosión implica desprender y transportar materiales.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-016",
        "number": 16,
        "topic": "Tierra y espacio",
        "concept": "inclinacion_terrestre_y_estaciones",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué explica principalmente que existan estaciones distintas durante el año?",
        "options": [
          "La inclinación del eje terrestre mientras la Tierra orbita el Sol",
          "Que el Sol se apague cada noche",
          "Que la Luna cambie de tamaño",
          "La rotación diaria de la Tierra"
        ],
        "correctAnswer": "La inclinación del eje terrestre mientras la Tierra orbita el Sol",
        "explanation": "La inclinación hace que cada hemisferio reciba distinta cantidad y ángulo de luz solar a lo largo de la órbita.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-017",
        "number": 17,
        "topic": "Sonido",
        "concept": "sonido_requiere_medio_material",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El sonido puede propagarse por el vacío del espacio igual que por el aire.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "El sonido necesita un medio material, como aire, agua o sólidos; el vacío no tiene partículas que transmitan la vibración.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-018",
        "number": 18,
        "topic": "Electricidad",
        "concept": "cobre_conductor_electrico",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál de estos materiales conduce bien la electricidad?",
        "options": [
          "Caucho",
          "Cobre",
          "Madera seca",
          "Plástico"
        ],
        "correctAnswer": "Cobre",
        "explanation": "El cobre es un metal conductor utilizado en muchos cables eléctricos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-019",
        "number": 19,
        "topic": "Densidad",
        "concept": "flotacion_por_densidad_relativa",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un trozo de madera flota en agua. ¿Cuál explicación es la más adecuada?",
        "options": [
          "La madera no tiene masa",
          "El agua deja de ejercer fuerzas",
          "La densidad promedio de la madera es menor que la del agua",
          "La madera se convierte en aire"
        ],
        "correctAnswer": "La densidad promedio de la madera es menor que la del agua",
        "explanation": "Un objeto suele flotar si su densidad promedio es menor que la del líquido que desplaza.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-020",
        "number": 20,
        "topic": "Diseño experimental",
        "concept": "variable_independiente_experimento_plantas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos plantas iguales reciben la misma agua y suelo, pero distinta cantidad de luz. ¿Qué factor se está poniendo a prueba?",
        "options": [
          "El tipo de recipiente",
          "La cantidad de agua",
          "El tamaño de las semillas",
          "La luz recibida"
        ],
        "correctAnswer": "La luz recibida",
        "explanation": "Al mantener iguales las otras condiciones y variar solo la luz, se puede estudiar su efecto en el crecimiento.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-021",
        "number": 21,
        "topic": "Biología",
        "concept": "transpiracion_y_condensacion_en_bolsa",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una bolsa transparente cubre algunas hojas de una planta. Luego aparecen gotas en su interior. ¿De dónde provino principalmente esa agua?",
        "options": [
          "Del vapor liberado por las hojas",
          "De la luz atrapada en la bolsa",
          "De oxígeno que se volvió líquido",
          "Del plástico que produjo agua"
        ],
        "correctAnswer": "Del vapor liberado por las hojas",
        "explanation": "Las plantas liberan vapor de agua por las hojas; al enfriarse, puede condensarse en la bolsa.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-022",
        "number": 22,
        "topic": "Electricidad",
        "concept": "cerrar_circuito_interruptor_abierto",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una linterna tiene pilas nuevas, pero no enciende. El interruptor está abierto. ¿Qué acción probarías primero?",
        "options": [
          "Cubrir el foco con papel",
          "Cerrar el interruptor para completar el circuito",
          "Sacar todas las conexiones",
          "Enfriar la carcasa"
        ],
        "correctAnswer": "Cerrar el interruptor para completar el circuito",
        "explanation": "Al cerrar el interruptor se completa el circuito y puede circular corriente hasta el foco.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-023",
        "number": 23,
        "topic": "Ecosistemas",
        "concept": "efecto_disminucion_recurso_alimenticio",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En un bosque disminuyen mucho los insectos que comen ciertas aves. ¿Qué cambio podría ocurrir después?",
        "options": [
          "Las aves tendrán más alimento disponible",
          "Las plantas dejarán de necesitar agua",
          "Algunas aves podrían disminuir o buscar otro alimento",
          "La luz solar desaparecerá"
        ],
        "correctAnswer": "Algunas aves podrían disminuir o buscar otro alimento",
        "explanation": "Menos alimento puede reducir la supervivencia o reproducción de sus consumidores, o hacer que busquen otros recursos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-024",
        "number": 24,
        "topic": "Magnetismo",
        "concept": "evidencia_prueba_atraccion_magnetica",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si un imán atrae un clavo de hierro, pero no una pieza de plástico, el resultado apoya la idea de que ciertos materiales son atraídos por imanes.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La observación concuerda con la hipótesis, aunque conviene repetir pruebas con varios objetos de cada material.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-025",
        "number": 25,
        "topic": "Tierra y espacio",
        "concept": "hemisferio_hacia_sol_temporada",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En junio, el hemisferio norte está inclinado hacia el Sol. ¿Qué sucede allí respecto al hemisferio sur?",
        "options": [
          "Recibe menos luz directa y tiene invierno",
          "Tiene el mismo patrón que el hemisferio sur",
          "Deja de rotar durante esa estación",
          "Recibe luz más directa y tiene verano"
        ],
        "correctAnswer": "Recibe luz más directa y tiene verano",
        "explanation": "La inclinación hace que el hemisferio norte reciba luz más directa en junio; el sur se inclina en sentido contrario.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-026",
        "number": 26,
        "topic": "Química",
        "concept": "carga_electron_negativa",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué partícula del átomo tiene carga eléctrica negativa?",
        "options": [
          "Electrón",
          "Protón",
          "Neutrón",
          "Núcleo"
        ],
        "correctAnswer": "Electrón",
        "explanation": "Los electrones tienen carga negativa y se encuentran alrededor del núcleo del átomo.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-027",
        "number": 27,
        "topic": "Óptica",
        "concept": "aumento_imagen_lupa",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Una lupa puede hacer que un objeto parezca más grande sin cambiar el tamaño real del objeto.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La lente curva desvía la luz y forma una imagen aumentada; el objeto conserva su tamaño.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-028",
        "number": 28,
        "topic": "Biología",
        "concept": "intercambio_gaseoso_pulmones",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Dónde ocurre principalmente el intercambio de oxígeno y dióxido de carbono al respirar?",
        "options": [
          "En el estómago",
          "En los pulmones",
          "En los riñones",
          "En los huesos"
        ],
        "correctAnswer": "En los pulmones",
        "explanation": "En los pulmones, el oxígeno pasa a la sangre y parte del dióxido de carbono pasa de la sangre al aire exhalado.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-029",
        "number": 29,
        "topic": "Geología",
        "concept": "roca_ignea_desde_lava",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una roca se forma cuando la lava se enfría y se endurece. ¿A qué grupo pertenece?",
        "options": [
          "Sedimentaria",
          "Metamórfica",
          "Ígnea",
          "Orgánica"
        ],
        "correctAnswer": "Ígnea",
        "explanation": "Las rocas ígneas se forman cuando el magma o la lava se enfrían y solidifican.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-030",
        "number": 30,
        "topic": "Astronomía",
        "concept": "luz_propia_sol_reflejada_luna",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué diferencia al Sol de la Luna en cuanto a luz visible?",
        "options": [
          "La Luna produce más luz",
          "Ambos producen su propia luz",
          "Ninguno emite ni refleja luz",
          "El Sol emite luz propia; la Luna refleja luz solar"
        ],
        "correctAnswer": "El Sol emite luz propia; la Luna refleja luz solar",
        "explanation": "El Sol es una estrella que emite luz; la Luna se ve brillante porque refleja luz del Sol.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-031",
        "number": 31,
        "topic": "Astronomía",
        "concept": "luna_satelite_natural_tierra",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La Luna es el satélite natural de la Tierra.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La Luna gira alrededor de la Tierra de forma natural.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-032",
        "number": 32,
        "topic": "Meteorología",
        "concept": "instrumento_medicion_lluvia",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué instrumento recoge y mide cuánta lluvia cae en un lugar?",
        "options": [
          "Pluviómetro",
          "Termómetro",
          "Brújula",
          "Barómetro"
        ],
        "correctAnswer": "Pluviómetro",
        "explanation": "El pluviómetro recoge la precipitación para medir su cantidad durante un periodo.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-033",
        "number": 33,
        "topic": "Biología",
        "concept": "caracteristica_animales_vertebrados",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué característica tienen en común los animales vertebrados?",
        "options": [
          "Todos viven en el agua",
          "Tienen columna vertebral",
          "Ponen huevos",
          "Tienen seis patas"
        ],
        "correctAnswer": "Tienen columna vertebral",
        "explanation": "Los vertebrados poseen una columna vertebral; pueden vivir en distintos ambientes y tener formas diversas de reproducción.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-034",
        "number": 34,
        "topic": "Cambios de la materia",
        "concept": "fusion_cambio_fisico_agua",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un cubo de hielo se derrite y se convierte en agua líquida. ¿Qué tipo de cambio ocurrió?",
        "options": [
          "Una combustión",
          "Una reacción que crea otra sustancia",
          "Un cambio físico de estado",
          "Una descomposición biológica"
        ],
        "correctAnswer": "Un cambio físico de estado",
        "explanation": "Al derretirse, el agua cambia de estado, pero sigue siendo la misma sustancia.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-035",
        "number": 35,
        "topic": "Ecología",
        "concept": "habitat_lugar_y_recursos",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El hábitat de un organismo incluye el lugar y las condiciones donde encuentra recursos para vivir.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Un hábitat ofrece condiciones y recursos como alimento, agua y refugio.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-036",
        "number": 36,
        "topic": "Física",
        "concept": "funcion_mecanica_palanca",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una persona usa una palanca para levantar una roca pesada. ¿Qué hace una máquina simple como la palanca?",
        "options": [
          "Elimina la gravedad",
          "Produce energía de la nada",
          "Cambia la roca por otra sustancia",
          "Puede cambiar la dirección o la fuerza necesaria para moverla"
        ],
        "correctAnswer": "Puede cambiar la dirección o la fuerza necesaria para moverla",
        "explanation": "Las máquinas simples pueden cambiar la dirección de una fuerza o ayudar a mover una carga aplicando la fuerza de otra manera.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-037",
        "number": 37,
        "topic": "Energía",
        "concept": "conversion_fotovoltaica_luz_electricidad",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué transformación ocurre principalmente en un panel solar fotovoltaico?",
        "options": [
          "Luz solar en energía eléctrica",
          "Sonido en energía química",
          "Electricidad en carbón",
          "Calor en viento"
        ],
        "correctAnswer": "Luz solar en energía eléctrica",
        "explanation": "Las celdas fotovoltaicas convierten parte de la luz recibida en energía eléctrica.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-038",
        "number": 38,
        "topic": "Astronomía",
        "concept": "fases_luna_por_orbita_y_luz",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué vemos diferentes fases de la Luna durante el mes?",
        "options": [
          "La Luna cambia de forma cada noche",
          "Cambia nuestra vista de la parte iluminada mientras la Luna orbita la Tierra",
          "La sombra de la Tierra cubre la Luna todas las noches",
          "Las nubes modifican permanentemente la superficie lunar"
        ],
        "correctAnswer": "Cambia nuestra vista de la parte iluminada mientras la Luna orbita la Tierra",
        "explanation": "El Sol ilumina siempre una mitad de la Luna; al orbitar, desde la Tierra vemos distintas porciones de esa mitad.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-039",
        "number": 39,
        "topic": "Cuerpo humano",
        "concept": "contraccion_muscular_mueve_huesos",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo ayudan los músculos a que el cuerpo mueva los huesos?",
        "options": [
          "Los convierten en sangre",
          "Los hacen crecer durante cada movimiento",
          "Al contraerse, tiran de los huesos unidos a ellos",
          "Los separan de las articulaciones"
        ],
        "correctAnswer": "Al contraerse, tiran de los huesos unidos a ellos",
        "explanation": "Los músculos se contraen y ejercen fuerza sobre los huesos mediante tendones para producir movimiento.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-040",
        "number": 40,
        "topic": "Magnetismo",
        "concept": "repulsion_polos_iguales",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué suele ocurrir cuando se acercan dos polos iguales de imanes?",
        "options": [
          "Se derriten",
          "Se vuelven invisibles",
          "Se atraen siempre",
          "Se repelen"
        ],
        "correctAnswer": "Se repelen",
        "explanation": "Los polos iguales se repelen; los polos opuestos se atraen.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-041",
        "number": 41,
        "topic": "Atmósfera",
        "concept": "tiempo_meteorologico_troposfera",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué capa de la atmósfera ocurren la mayoría de los fenómenos meteorológicos que vivimos?",
        "options": [
          "Troposfera",
          "Exosfera",
          "Termosfera",
          "Mesosfera"
        ],
        "correctAnswer": "Troposfera",
        "explanation": "La mayor parte del tiempo atmosférico se desarrolla en la troposfera, la capa más cercana a la superficie.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-042",
        "number": 42,
        "topic": "Microorganismos",
        "concept": "microorganismos_no_siempre_patogenos",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Todos los microorganismos causan enfermedades.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Muchos microorganismos no causan enfermedad; algunos son beneficiosos o cumplen funciones importantes en los ecosistemas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-043",
        "number": 43,
        "topic": "Ecología",
        "concept": "comunidad_conjunto_de_poblaciones",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En un bosque viven varias especies de árboles, aves e insectos. ¿Cómo se llama el conjunto de sus poblaciones?",
        "options": [
          "Una célula",
          "Una comunidad",
          "Un individuo",
          "Una roca"
        ],
        "correctAnswer": "Una comunidad",
        "explanation": "Una comunidad reúne las poblaciones de diferentes especies que viven en un área.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-044",
        "number": 44,
        "topic": "Atmósfera",
        "concept": "aire_ocupa_espacio_y_ejerce_presion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una bolsa vacía se infla cuando se sopla dentro. ¿Qué evidencia muestra esto sobre el aire?",
        "options": [
          "No ocupa espacio",
          "No ejerce ninguna fuerza",
          "Ocupa espacio y puede ejercer presión",
          "Es siempre un líquido"
        ],
        "correctAnswer": "Ocupa espacio y puede ejercer presión",
        "explanation": "El aire ocupa el interior de la bolsa y sus partículas ejercen presión sobre sus paredes.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-045",
        "number": 45,
        "topic": "Geología",
        "concept": "formacion_roca_sedimentaria",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se forman muchas rocas sedimentarias?",
        "options": [
          "Al congelarse el núcleo terrestre",
          "Cuando una estrella explota",
          "Al transformarse un metal en gas",
          "Cuando sedimentos se acumulan y se consolidan"
        ],
        "correctAnswer": "Cuando sedimentos se acumulan y se consolidan",
        "explanation": "Los sedimentos pueden acumularse y, con el tiempo, compactarse y cementarse hasta formar roca.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-046",
        "number": 46,
        "topic": "Fuerzas",
        "concept": "friccion_calzado_y_superficie_mojada",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una cancha está mojada y resbalosa. ¿Qué calzado ayudaría más a evitar que una persona se deslice?",
        "options": [
          "Zapatos con suela de buen agarre",
          "Medias lisas",
          "Zapatos con suela pulida",
          "Caminar sobre plástico suelto"
        ],
        "correctAnswer": "Zapatos con suela de buen agarre",
        "explanation": "Una suela con buen agarre aumenta la fricción con el suelo y puede reducir el riesgo de resbalar.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-047",
        "number": 47,
        "topic": "Calor",
        "concept": "comparar_materiales_aislantes_controlando_variables",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una clase quiere comparar qué material mantiene caliente el agua por más tiempo. ¿Qué prueba sería más justa?",
        "options": [
          "Usar vasos distintos y volúmenes diferentes",
          "Poner igual cantidad de agua a igual temperatura en vasos iguales y cambiar solo el material aislante",
          "Medir un vaso por la mañana y otro al día siguiente",
          "Elegir el vaso que se vea más grueso sin medir"
        ],
        "correctAnswer": "Poner igual cantidad de agua a igual temperatura en vasos iguales y cambiar solo el material aislante",
        "explanation": "Mantener iguales las otras condiciones y cambiar solo el aislante permite comparar su efecto en la pérdida de calor.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-048",
        "number": 48,
        "topic": "Interpretación de datos",
        "concept": "calcular_promedio_crecimiento",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En una semana, tres plantas crecieron 2 cm, 5 cm y 3 cm. ¿Cuál fue el crecimiento promedio?",
        "options": [
          "2 cm",
          "3 cm",
          "3⅓ cm",
          "5 cm"
        ],
        "correctAnswer": "3⅓ cm",
        "explanation": "Se suman las medidas (10 cm) y se divide entre las tres plantas: 10 ÷ 3 ≈ 3⅓ cm.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-049",
        "number": 49,
        "topic": "Cambio climático",
        "concept": "diferenciar_tiempo_y_tendencia_climatica",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Un solo día frío demuestra por sí mismo que el clima de una región se está enfriando a largo plazo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "El tiempo cambia día a día; para reconocer tendencias del clima se analizan registros prolongados.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-050",
        "number": 50,
        "topic": "Agua y suelo",
        "concept": "investigar_turbidez_tras_lluvia",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Después de una tormenta, el agua de un arroyo se ve turbia. ¿Qué observación ayudaría a investigar si arrastra sedimentos del suelo?",
        "options": [
          "Medir solo la temperatura del aire en la ciudad",
          "Mirar el arroyo una semana después sin tomar datos",
          "Preguntar de qué color era el cielo",
          "Comparar muestras de agua tomadas antes y después de la lluvia y observar partículas"
        ],
        "correctAnswer": "Comparar muestras de agua tomadas antes y después de la lluvia y observar partículas",
        "explanation": "Comparar muestras en condiciones distintas permite comprobar si aumentan las partículas transportadas por la escorrentía.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-051",
        "number": 51,
        "topic": "Cuerpo humano",
        "concept": "costillas_protegen_organos_torax",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué huesos forman una caja que protege el corazón y los pulmones?",
        "options": [
          "Las costillas",
          "Las vértebras",
          "Las clavículas",
          "Los huesos de la pelvis"
        ],
        "correctAnswer": "Las costillas",
        "explanation": "Las costillas se unen al esternón y forman una caja que protege órganos del tórax.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-052",
        "number": 52,
        "topic": "Ecosistemas",
        "concept": "descomponedores_reciclan_nutrientes",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Algunos hongos y bacterias descomponen restos de seres vivos y devuelven nutrientes al ambiente.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Los descomponedores transforman materia orgánica y contribuyen al reciclaje de nutrientes.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-053",
        "number": 53,
        "topic": "Cuerpo humano",
        "concept": "corazon_bombea_sangre",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué órgano impulsa la sangre por el cuerpo?",
        "options": [
          "Pulmón",
          "Corazón",
          "Estómago",
          "Riñón"
        ],
        "correctAnswer": "Corazón",
        "explanation": "El corazón se contrae para mover la sangre por los vasos sanguíneos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-054",
        "number": 54,
        "topic": "Paleontología",
        "concept": "fosil_resto_o_huella_antigua",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué es un fósil?",
        "options": [
          "Un mineral formado dentro de una roca",
          "Un cristal que creció en el agua",
          "Un resto o huella preservada de vida antigua",
          "Un sedimento reciente del fondo de un río"
        ],
        "correctAnswer": "Un resto o huella preservada de vida antigua",
        "explanation": "Los fósiles conservan restos o señales de organismos que vivieron en el pasado.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-055",
        "number": 55,
        "topic": "Física",
        "concept": "diferencia_masa_y_peso_gravedad",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Si una persona lleva una mochila de la Tierra a la Luna, ¿qué propiedad cambia más por la menor gravedad lunar?",
        "options": [
          "Su masa",
          "El material de la mochila",
          "El número de objetos dentro",
          "Su peso"
        ],
        "correctAnswer": "Su peso",
        "explanation": "La masa no cambia por trasladarla, pero el peso depende de la fuerza de gravedad del lugar.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-056",
        "number": 56,
        "topic": "Astronomía",
        "concept": "sol_estrella_mas_cercana",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es la estrella más cercana a la Tierra?",
        "options": [
          "El Sol",
          "Sirio",
          "Próxima Centauri",
          "Polaris"
        ],
        "correctAnswer": "El Sol",
        "explanation": "El Sol es la estrella del sistema solar y la más cercana a nuestro planeta.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-057",
        "number": 57,
        "topic": "Astronomía",
        "concept": "ubicacion_cinturon_asteroides",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "El cinturón principal de asteroides se encuentra entre Marte y Júpiter.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La mayoría de los asteroides del cinturón principal orbitan alrededor del Sol entre esos planetas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-058",
        "number": 58,
        "topic": "Astronomía",
        "concept": "composicion_general_cometas",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué característica se asocia con muchos cometas?",
        "options": [
          "Son cuerpos rocosos ricos en metales, como muchos asteroides",
          "Contienen hielo, polvo y material rocoso",
          "Son estrellas calientes formadas por gas",
          "Son planetas con una superficie sólida y estable"
        ],
        "correctAnswer": "Contienen hielo, polvo y material rocoso",
        "explanation": "Los cometas son cuerpos pequeños que contienen hielo y polvo; al acercarse al Sol pueden formar una coma y una cola.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-059",
        "number": 59,
        "topic": "Sistema solar",
        "concept": "gravedad_sol_y_orbitas_planetarias",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué mantiene a los planetas en órbita alrededor del Sol?",
        "options": [
          "El viento solar los empuja hacia afuera",
          "La luz del Sol los atrae como un imán",
          "La gravedad del Sol",
          "La rotación de la Tierra"
        ],
        "correctAnswer": "La gravedad del Sol",
        "explanation": "La gravedad del Sol mantiene a los planetas ligados a órbitas alrededor de él.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-060",
        "number": 60,
        "topic": "Cuerpo humano",
        "concept": "funcion_filtracion_rinones",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué hacen principalmente los riñones con la sangre?",
        "options": [
          "Intercambian gases durante la respiración",
          "Descomponen los alimentos",
          "Bombean sangre por los vasos",
          "Filtran desechos y regulan el agua del cuerpo"
        ],
        "correctAnswer": "Filtran desechos y regulan el agua del cuerpo",
        "explanation": "Los riñones filtran la sangre, eliminan desechos y ayudan a regular el agua y las sales.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-061",
        "number": 61,
        "topic": "Ecosistemas",
        "concept": "multiples_relaciones_red_alimentaria",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué muestra una red alimentaria que una cadena simple no representa por completo?",
        "options": [
          "Varias relaciones de alimentación conectadas",
          "Un único recorrido lineal de alimentación",
          "Un listado de factores no vivos del lugar",
          "Un mapa de refugios sin relaciones de alimentación"
        ],
        "correctAnswer": "Varias relaciones de alimentación conectadas",
        "explanation": "Una red alimentaria conecta distintas cadenas y muestra que un organismo puede relacionarse con varios otros.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-062",
        "number": 62,
        "topic": "Cuerpo humano",
        "concept": "absorcion_nutrientes_intestino_delgado",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué parte del sistema digestivo se absorbe la mayor parte de los nutrientes de los alimentos?",
        "options": [
          "Esófago",
          "Intestino delgado",
          "Boca",
          "Intestino grueso"
        ],
        "correctAnswer": "Intestino delgado",
        "explanation": "La mayor parte de los nutrientes pasa a la sangre a través de las paredes del intestino delgado.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-063",
        "number": 63,
        "topic": "Fenómenos atmosféricos",
        "concept": "origen_comun_relampago_y_trueno",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El relámpago y el trueno se originan en la misma descarga eléctrica de una tormenta.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El relámpago es la luz de la descarga; el trueno es el sonido producido cuando esta calienta rápidamente el aire.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-064",
        "number": 64,
        "topic": "Geología",
        "concept": "movimiento_lento_placas_tectonicas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ocurre con las placas tectónicas de la superficie terrestre?",
        "options": [
          "Permanecen inmóviles para siempre",
          "Flotan separadas de la Tierra",
          "Se mueven lentamente unas respecto a otras",
          "Cambian de posición cada día por las mareas"
        ],
        "correctAnswer": "Se mueven lentamente unas respecto a otras",
        "explanation": "Las placas se desplazan lentamente; sus interacciones pueden producir sismos y formar montañas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-065",
        "number": 65,
        "topic": "Sonido",
        "concept": "frecuencia_y_tono_sonido",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué cambio produce normalmente un sonido de tono más alto?",
        "options": [
          "Una vibración más lenta",
          "Una vibración con mayor amplitud",
          "Una distancia mayor a quien escucha",
          "Una vibración más rápida"
        ],
        "correctAnswer": "Una vibración más rápida",
        "explanation": "El tono aumenta cuando aumenta la frecuencia de vibración.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-066",
        "number": 66,
        "topic": "Biología celular",
        "concept": "cloroplasto_captura_luz",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué estructura de las células vegetales captura energía luminosa para la fotosíntesis?",
        "options": [
          "Cloroplasto",
          "Núcleo",
          "Membrana externa",
          "Vacuola"
        ],
        "correctAnswer": "Cloroplasto",
        "explanation": "Los cloroplastos contienen clorofila y son el sitio principal de la fotosíntesis en las células vegetales.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-067",
        "number": 67,
        "topic": "Cambios químicos",
        "concept": "oxidacion_hierro_forma_oxido",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un clavo de hierro queda expuesto al agua y al oxígeno y aparece óxido. ¿Qué tipo de cambio ocurrió?",
        "options": [
          "Un cambio de estado",
          "Una reacción química que formó otra sustancia",
          "Una disolución sin cambio de material",
          "Una separación de la mezcla"
        ],
        "correctAnswer": "Una reacción química que formó otra sustancia",
        "explanation": "El hierro reacciona con el oxígeno y forma óxido, una sustancia distinta del hierro original.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-068",
        "number": 68,
        "topic": "Atmósfera",
        "concept": "efecto_invernadero_absorcion_infrarroja",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué algunos gases de la atmósfera contribuyen a mantener la Tierra más cálida?",
        "options": [
          "Porque reflejan toda la luz visible hacia el suelo",
          "Porque bloquean toda la radiación ultravioleta",
          "Porque absorben y reemiten parte de la energía infrarroja que sale de la superficie",
          "Porque producen calor al convertir oxígeno en luz"
        ],
        "correctAnswer": "Porque absorben y reemiten parte de la energía infrarroja que sale de la superficie",
        "explanation": "Los gases de efecto invernadero absorben parte de la radiación infrarroja y reemiten energía, lo que calienta la atmósfera baja.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-069",
        "number": 69,
        "topic": "Química",
        "concept": "atomos_se_reorganizan_reacciones",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "En una reacción química común, los átomos desaparecen por completo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "En una reacción, los átomos se reorganizan para formar sustancias nuevas; no desaparecen.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-070",
        "number": 70,
        "topic": "Meteorología",
        "concept": "viento_por_diferencia_presion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué movimiento del aire suele llamarse viento?",
        "options": [
          "El giro de la Tierra alrededor del Sol",
          "El cambio de estado del agua",
          "La vibración de las nubes",
          "El desplazamiento del aire de zonas de mayor presión hacia zonas de menor presión"
        ],
        "correctAnswer": "El desplazamiento del aire de zonas de mayor presión hacia zonas de menor presión",
        "explanation": "Las diferencias de presión impulsan el movimiento del aire, que percibimos como viento.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-071",
        "number": 71,
        "topic": "Suelo y ecosistemas",
        "concept": "vegetacion_reduce_erosion_ladera",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una ladera sin plantas pierde suelo durante las lluvias. ¿Qué acción puede ayudar a reducir la erosión?",
        "options": [
          "Recuperar una cubierta de plantas con raíces que sujeten el suelo",
          "Retirar las piedras y raíces restantes",
          "Dejar el suelo descubierto",
          "Aumentar el escurrimiento cuesta abajo"
        ],
        "correctAnswer": "Recuperar una cubierta de plantas con raíces que sujeten el suelo",
        "explanation": "La vegetación reduce el impacto de la lluvia y sus raíces ayudan a mantener el suelo en su lugar.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-072",
        "number": 72,
        "topic": "Energía solar",
        "concept": "absorcion_luz_superficie_oscura",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un horno solar debe calentar una olla usando luz del Sol. ¿Qué superficie interior suele absorber más energía luminosa?",
        "options": [
          "Una superficie blanca y brillante",
          "Una superficie oscura y poco reflectante",
          "Un espejo orientado hacia afuera",
          "Una lámina transparente que no cubra la olla"
        ],
        "correctAnswer": "Una superficie oscura y poco reflectante",
        "explanation": "Las superficies oscuras absorben más luz que las claras y brillantes, que reflejan una mayor parte.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-073",
        "number": 73,
        "topic": "Astronomía",
        "concept": "alineacion_eclipse_lunar",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Durante un eclipse lunar, ¿cómo se ubican el Sol, la Tierra y la Luna?",
        "options": [
          "La Luna queda entre el Sol y la Tierra",
          "El Sol queda entre la Tierra y la Luna",
          "La Tierra queda entre el Sol y la Luna",
          "Los tres cuerpos dejan de moverse"
        ],
        "correctAnswer": "La Tierra queda entre el Sol y la Luna",
        "explanation": "La Tierra se interpone entre el Sol y la Luna y su sombra oscurece la Luna.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-074",
        "number": 74,
        "topic": "Germinación",
        "concept": "luz_no_es_requisito_universal_germinacion",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Todas las semillas necesitan recibir luz directa para comenzar a germinar.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Muchas semillas pueden germinar bajo el suelo sin luz directa, si tienen agua, oxígeno y condiciones adecuadas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-075",
        "number": 75,
        "topic": "Reacciones químicas",
        "concept": "burbujas_evidencia_produccion_gas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Al mezclar vinagre y bicarbonato aparecen burbujas. ¿Qué evidencia aporta esto?",
        "options": [
          "El líquido se congeló",
          "Un sólido se trituró en piezas pequeñas",
          "Una sustancia se disolvió sin burbujas",
          "Se produjo un gas durante la reacción"
        ],
        "correctAnswer": "Se produjo un gas durante la reacción",
        "explanation": "Las burbujas son evidencia de un gas que se forma cuando las sustancias reaccionan.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-076",
        "number": 76,
        "topic": "Biodiversidad",
        "concept": "biodiversidad_variedad_seres_vivos",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué describe la biodiversidad de un lugar?",
        "options": [
          "La variedad de seres vivos que habitan allí",
          "La cantidad de lluvia de un día",
          "La profundidad de sus rocas",
          "El número de edificios"
        ],
        "correctAnswer": "La variedad de seres vivos que habitan allí",
        "explanation": "La biodiversidad se refiere a la variedad de formas de vida presentes en un lugar.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-077",
        "number": 77,
        "topic": "Ecosistemas",
        "concept": "ecosistema_factores_vivos_y_no_vivos",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Un ecosistema incluye seres vivos y elementos no vivos del ambiente.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Los organismos interactúan entre sí y con factores como el agua, el suelo y la luz.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-078",
        "number": 78,
        "topic": "Meteorología",
        "concept": "instrumento_medicion_presion_aire",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué mide un barómetro?",
        "options": [
          "La cantidad de lluvia",
          "La presión del aire",
          "La velocidad de un río",
          "La temperatura corporal"
        ],
        "correctAnswer": "La presión del aire",
        "explanation": "El barómetro mide la presión atmosférica, que puede ayudar a observar cambios del tiempo.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-079",
        "number": 79,
        "topic": "Geología",
        "concept": "formacion_roca_metamorfica",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué condiciones transforman una roca en roca metamórfica?",
        "options": [
          "Congelación y evaporación",
          "Compactación y cementación solamente",
          "Calor y presión dentro de la Tierra",
          "Derretimiento completo en la superficie"
        ],
        "correctAnswer": "Calor y presión dentro de la Tierra",
        "explanation": "El calor y la presión pueden cambiar una roca sin fundirla por completo y formar una roca metamórfica.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-080",
        "number": 80,
        "topic": "Cuerpo humano",
        "concept": "componentes_sistema_nervioso_central",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué estructuras forman el sistema nervioso central?",
        "options": [
          "Corazón y vasos sanguíneos",
          "Pulmones y tráquea",
          "Estómago e intestinos",
          "Encéfalo y médula espinal"
        ],
        "correctAnswer": "Encéfalo y médula espinal",
        "explanation": "El sistema nervioso central está formado por el encéfalo y la médula espinal.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-081",
        "number": 81,
        "topic": "Agua subterránea",
        "concept": "acuifero_almacena_agua_subterranea",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama una capa de roca o sedimento que puede almacenar y transmitir agua subterránea?",
        "options": [
          "Acuífero",
          "Cráter",
          "Glaciar",
          "Delta"
        ],
        "correctAnswer": "Acuífero",
        "explanation": "Un acuífero es una formación subterránea capaz de almacenar y permitir el movimiento del agua.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-082",
        "number": 82,
        "topic": "Alimentación animal",
        "concept": "dieta_omnivora",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué animal se clasifica como omnívoro?",
        "options": [
          "Uno que come únicamente plantas",
          "Uno que se alimenta de plantas y animales",
          "Uno que produce su alimento con luz",
          "Uno que come solamente restos minerales"
        ],
        "correctAnswer": "Uno que se alimenta de plantas y animales",
        "explanation": "Los omnívoros obtienen alimento tanto de plantas como de otros animales.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-083",
        "number": 83,
        "topic": "Materia",
        "concept": "estados_naturales_agua",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En la naturaleza, el agua puede encontrarse como sólido, líquido y gas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El hielo, el agua líquida y el vapor de agua son los tres estados comunes del agua.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-084",
        "number": 84,
        "topic": "Cambios de estado",
        "concept": "sublimacion_solido_a_gas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama el cambio directo de sólido a gas, sin pasar por líquido?",
        "options": [
          "Condensación",
          "Fusión",
          "Sublimación",
          "Congelación"
        ],
        "correctAnswer": "Sublimación",
        "explanation": "En la sublimación, una sustancia pasa del estado sólido al gaseoso directamente.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-085",
        "number": 85,
        "topic": "Clima",
        "concept": "diferencia_tiempo_y_clima",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué resume principalmente el clima de una región?",
        "options": [
          "Cambios de cada hora",
          "Condiciones de un día",
          "Patrones de muchos años",
          "Lluvia de una tarde"
        ],
        "correctAnswer": "Lluvia de una tarde",
        "explanation": "El tiempo puede variar en horas o días; el clima describe tendencias observadas durante periodos largos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-086",
        "number": 86,
        "topic": "Ciclo del agua",
        "concept": "infiltracion_agua_en_suelo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Cuando parte de la lluvia se filtra desde la superficie hacia el suelo, ocurre:",
        "options": [
          "Infiltración",
          "Fusión",
          "Condensación",
          "Combustión"
        ],
        "correctAnswer": "Infiltración",
        "explanation": "La infiltración es el paso del agua desde la superficie hacia el suelo y sus capas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-087",
        "number": 87,
        "topic": "Atmósfera",
        "concept": "presion_atmosferica_y_altitud",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "La presión del aire suele disminuir al aumentar la altitud.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "A mayor altura hay menos aire por encima que ejerza peso y presión.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-088",
        "number": 88,
        "topic": "Biología vegetal",
        "concept": "funcion_estomas_hojas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función cumplen principalmente los estomas de las hojas?",
        "options": [
          "Producir raíces nuevas",
          "Permitir el intercambio de gases y la salida de vapor de agua",
          "Transportar sangre",
          "Formar semillas directamente"
        ],
        "correctAnswer": "Permitir el intercambio de gases y la salida de vapor de agua",
        "explanation": "Los estomas son poros que regulan el intercambio de gases y la pérdida de vapor de agua de la planta.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-089",
        "number": 89,
        "topic": "Energía",
        "concept": "escala_tiempo_formacion_petroleo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué el petróleo se considera un recurso no renovable a escala humana?",
        "options": [
          "Porque nunca contiene energía",
          "Porque se forma cada vez que llueve",
          "Porque tarda millones de años en formarse y se consume mucho más rápido",
          "Porque solo existe en el océano"
        ],
        "correctAnswer": "Porque tarda millones de años en formarse y se consume mucho más rápido",
        "explanation": "El petróleo se forma durante tiempos geológicos, mientras que las personas lo consumen en periodos mucho más cortos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-090",
        "number": 90,
        "topic": "Astronomía",
        "concept": "ano_luz_unidad_distancia",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué mide un año luz?",
        "options": [
          "Un periodo orbital",
          "La edad de una estrella",
          "Una distancia astronómica",
          "La distancia que recorre la luz en un año"
        ],
        "correctAnswer": "La distancia que recorre la luz en un año",
        "explanation": "Aunque contiene la palabra “año”, el año luz es una unidad de distancia.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-091",
        "number": 91,
        "topic": "Geología",
        "concept": "sismos_en_fallas_y_limites_placas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Dónde ocurren muchos terremotos porque las rocas se traban y luego se desplazan?",
        "options": [
          "En fallas y límites entre placas tectónicas",
          "En el centro de cada nube",
          "Dentro de todos los océanos al mismo tiempo",
          "Solo en los polos"
        ],
        "correctAnswer": "En fallas y límites entre placas tectónicas",
        "explanation": "El movimiento y la fricción en fallas, a menudo cerca de límites de placas, pueden liberar energía como un sismo.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-092",
        "number": 92,
        "topic": "Ecología",
        "concept": "competencia_especie_introducida_y_nativa",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué puede ocurrir si una especie introducida compite por alimento con especies nativas?",
        "options": [
          "Las poblaciones nativas aumentan siempre",
          "Las poblaciones nativas pueden disminuir",
          "Las poblaciones nativas no se ven afectadas",
          "Puede reducirse la biodiversidad del lugar"
        ],
        "correctAnswer": "Las poblaciones nativas pueden disminuir",
        "explanation": "Si una especie introducida obtiene recursos que también necesitan las nativas, la competencia puede afectar sus poblaciones.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-093",
        "number": 93,
        "topic": "Física",
        "concept": "caida_libre_sin_resistencia_aire",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Al ignorar la resistencia del aire, una pelota pesada cae siempre más rápido que una ligera.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Sin resistencia del aire, los objetos caen con la misma aceleración gravitatoria, aunque tengan masas distintas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-094",
        "number": 94,
        "topic": "Óptica",
        "concept": "dispersion_luz_en_gotas_agua",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué puede aparecer un arcoíris cuando la luz solar atraviesa gotas de agua?",
        "options": [
          "Las gotas convierten la luz en sonido",
          "El agua crea nuevos colores sin luz",
          "Las gotas separan la luz blanca en distintos colores",
          "La luz deja de viajar"
        ],
        "correctAnswer": "Las gotas separan la luz blanca en distintos colores",
        "explanation": "Al refractarse y reflejarse en gotas, la luz blanca se separa en colores visibles.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-095",
        "number": 95,
        "topic": "Astronomía",
        "concept": "alineacion_eclipse_solar",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué alineación produce un eclipse solar?",
        "options": [
          "La Tierra entre el Sol y la Luna",
          "El Sol entre la Tierra y la Luna",
          "La Luna detrás de Marte",
          "La Luna entre el Sol y la Tierra"
        ],
        "correctAnswer": "La Luna entre el Sol y la Tierra",
        "explanation": "En un eclipse solar, la Luna pasa entre el Sol y la Tierra y puede cubrir parte de la luz solar.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-096",
        "number": 96,
        "topic": "Conservación de suelos",
        "concept": "restaurar_cobertura_vegetal_anti_erosion",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Tras una obra, una ladera quedó sin vegetación y el barro llega al arroyo cuando llueve. ¿Qué acción ayudaría más a reducir el problema?",
        "options": [
          "Replantar vegetación adecuada para cubrir y sujetar el suelo",
          "Retirar las pocas raíces que quedan",
          "Abrir más surcos cuesta abajo",
          "Dejar el suelo expuesto hasta la próxima tormenta"
        ],
        "correctAnswer": "Replantar vegetación adecuada para cubrir y sujetar el suelo",
        "explanation": "La cobertura vegetal amortigua la lluvia y las raíces ayudan a mantener el suelo, reduciendo el arrastre de sedimentos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-097",
        "number": 97,
        "topic": "Luz y sombras",
        "concept": "longitud_sombra_posicion_aparente_sol",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "La sombra de un poste es corta al mediodía solar y más larga en la mañana. ¿Qué explica mejor el cambio?",
        "options": [
          "El poste cambia de altura",
          "Cambia la posición aparente del Sol en el cielo",
          "La Tierra deja de rotar por la mañana",
          "La sombra produce su propia luz"
        ],
        "correctAnswer": "Cambia la posición aparente del Sol en el cielo",
        "explanation": "La dirección y altura aparente del Sol cambian durante el día, modificando la longitud de la sombra.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-098",
        "number": 98,
        "topic": "Adaptación",
        "concept": "camuflaje_y_supervivencia_polillas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En árboles de corteza clara, las aves detectan más fácilmente las polillas oscuras. ¿Qué cambio podría ocurrir con varias generaciones?",
        "options": [
          "Aumentaría la proporción de polillas claras",
          "Aumentaría la proporción de polillas oscuras",
          "Se mantendría siempre igual la proporción",
          "Desaparecerían ambas poblaciones"
        ],
        "correctAnswer": "Se mantendría siempre igual la proporción",
        "explanation": "El camuflaje puede ayudar a sobrevivir; con varias generaciones, esa ventaja puede aumentar la proporción de polillas claras.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-099",
        "number": 99,
        "topic": "Ecosistemas",
        "concept": "competencia_por_recurso_limitado",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "En un ecosistema, dos especies que necesitan el mismo alimento pueden competir por ese recurso limitado.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Cuando un recurso no alcanza para todos los organismos que lo necesitan, puede producirse competencia.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-100",
        "number": 100,
        "topic": "Separación de mezclas",
        "concept": "separar_arena_sal_por_filtracion_evaporacion",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En una mezcla de agua, sal y arena, ¿qué secuencia permite separar la arena y recuperar la sal?",
        "options": [
          "Congelar todo y triturarlo",
          "Usar un imán para atraer la sal",
          "Filtrar primero para separar la sal y después evaporar la arena",
          "Filtrar para retirar la arena y evaporar el agua restante"
        ],
        "correctAnswer": "Filtrar para retirar la arena y evaporar el agua restante",
        "explanation": "El filtro retiene la arena; al evaporarse el agua, la sal disuelta queda como sólido.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-101",
        "number": 101,
        "topic": "Animales",
        "concept": "caracteristica_mamiferos_leche",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué característica distingue a los mamíferos?",
        "options": [
          "Las crías reciben leche producida por la madre",
          "Todos desarrollan plumas",
          "Todos respiran por branquias",
          "Todos ponen huevos"
        ],
        "correctAnswer": "Las crías reciben leche producida por la madre",
        "explanation": "Las hembras de los mamíferos producen leche para alimentar a sus crías; hay mamíferos terrestres y acuáticos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-102",
        "number": 102,
        "topic": "Plantas",
        "concept": "polen_reproduccion_plantas_flor",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "En muchas plantas con flores, el polen participa en la reproducción.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "El polen contiene células reproductoras que intervienen en la fecundación de las plantas con flores.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-103",
        "number": 103,
        "topic": "Medición",
        "concept": "probeta_medir_volumen_liquido",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué instrumento sirve para medir el volumen de un líquido en el laboratorio?",
        "options": [
          "Balanza",
          "Probeta",
          "Termómetro",
          "Brújula"
        ],
        "correctAnswer": "Probeta",
        "explanation": "La probeta graduada permite medir volúmenes de líquidos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-104",
        "number": 104,
        "topic": "Plantas",
        "concept": "fototropismo_crecimiento_hacia_luz",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una planta de interior crece inclinándose hacia la ventana. ¿Qué respuesta al estímulo observa?",
        "options": [
          "Germinación",
          "Evaporación",
          "Fototropismo",
          "Descomposición"
        ],
        "correctAnswer": "Fototropismo",
        "explanation": "El fototropismo es el crecimiento de una planta en respuesta a la dirección de la luz.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-105",
        "number": 105,
        "topic": "Energía",
        "concept": "energia_solar_fuente_renovable",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál fuente se repone de manera natural y produce energía eléctrica?",
        "options": [
          "Carbón",
          "Gasolina",
          "Gas natural",
          "Luz solar"
        ],
        "correctAnswer": "Luz solar",
        "explanation": "La energía solar proviene de la radiación del Sol y se considera renovable a escala humana.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-106",
        "number": 106,
        "topic": "Cuerpo humano",
        "concept": "estomago_mezcla_alimentos_jugos_digestivos",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué órgano mezcla los alimentos con jugos digestivos?",
        "options": [
          "Pulmón",
          "Riñón",
          "Corazón",
          "Estómago"
        ],
        "correctAnswer": "Estómago",
        "explanation": "El estómago mezcla los alimentos con jugos digestivos y los transforma parcialmente antes de que pasen al intestino.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-107",
        "number": 107,
        "topic": "Ciencia",
        "concept": "hipotesis_cientifica_comprobable",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Una hipótesis científica es una idea que no puede ponerse a prueba.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "Una hipótesis científica debe poder examinarse mediante observaciones o pruebas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-108",
        "number": 108,
        "topic": "Geología",
        "concept": "cuarzo_es_mineral_granito_roca",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál de estos materiales es un mineral?",
        "options": [
          "Granito",
          "Madera",
          "Cuarzo",
          "Plástico"
        ],
        "correctAnswer": "Cuarzo",
        "explanation": "El cuarzo es un mineral; el granito es una roca formada por varios minerales.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-109",
        "number": 109,
        "topic": "Calor",
        "concept": "conduccion_calor_en_metal",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una cuchara metálica se calienta al dejarla dentro de una sopa caliente. ¿Cómo se transfiere principalmente el calor por la cuchara?",
        "options": [
          "Conducción",
          "Evaporación",
          "Reflexión",
          "Condensación"
        ],
        "correctAnswer": "Conducción",
        "explanation": "En la conducción, el calor se transfiere a través de un material por contacto entre sus partículas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-110",
        "number": 110,
        "topic": "Ecosistemas",
        "concept": "flechas_cadena_alimentaria_transferencia",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una cadena alimentaria, las flechas suelen indicar:",
        "options": [
          "Dónde se refugia cada organismo",
          "El sentido del paso de materia y energía",
          "Qué organismo es más grande",
          "Cuánto tiempo vive cada especie"
        ],
        "correctAnswer": "El sentido del paso de materia y energía",
        "explanation": "Las flechas apuntan desde el organismo que sirve de alimento hacia quien lo consume.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-111",
        "number": 111,
        "topic": "Electricidad",
        "concept": "circuito_paralelo_ramas_independientes",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ventaja puede tener un circuito con bombillas conectadas en paralelo?",
        "options": [
          "La corriente deja de circular",
          "Todas se apagan si una se desconecta",
          "Cada bombilla puede seguir encendida si otra falla",
          "No necesita una fuente eléctrica"
        ],
        "correctAnswer": "Cada bombilla puede seguir encendida si otra falla",
        "explanation": "En un circuito paralelo hay más de una ruta para la corriente, por lo que una bombilla puede funcionar aunque otra rama falle.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-112",
        "number": 112,
        "topic": "Herencia",
        "concept": "herencia_rasgos_entre_generaciones",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un cachorro se parece a sus padres en el color del pelaje. ¿Qué explica mejor esa semejanza?",
        "options": [
          "El clima de ese día",
          "El alimento que comió una vez",
          "La sombra del lugar",
          "La herencia de características"
        ],
        "correctAnswer": "La herencia de características",
        "explanation": "Los descendientes reciben información hereditaria de sus progenitores que influye en muchos rasgos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-113",
        "number": 113,
        "topic": "Ciencia",
        "concept": "repetir_mediciones_aumenta_confiabilidad",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Repetir una medición y obtener resultados parecidos ayuda a confiar más en el resultado.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Repetir una medición permite comprobar si el resultado es consistente o si pudo deberse a una variación accidental.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-114",
        "number": 114,
        "topic": "Movimiento",
        "concept": "rapidez_promedio_distancia_tiempo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una bicicleta recorre 60 metros en 10 segundos. ¿Cuál es su rapidez promedio?",
        "options": [
          "6 m/s",
          "10 m/s",
          "50 m/s",
          "600 m/s"
        ],
        "correctAnswer": "6 m/s",
        "explanation": "La rapidez promedio es distancia dividida por tiempo: 60 ÷ 10 = 6 metros por segundo.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-115",
        "number": 115,
        "topic": "Energía",
        "concept": "pila_transformacion_quimica_a_electrica",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una linterna encendida, ¿qué transformación realiza principalmente la pila?",
        "options": [
          "Energía eléctrica en química",
          "Energía química en eléctrica",
          "Energía sonora en luminosa",
          "Energía térmica en gravitatoria"
        ],
        "correctAnswer": "Energía química en eléctrica",
        "explanation": "La pila convierte energía química almacenada en energía eléctrica para el circuito.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-116",
        "number": 116,
        "topic": "Biología",
        "concept": "absorcion_agua_y_anclaje_raices",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función cumplen principalmente las raíces de muchas plantas?",
        "options": [
          "Producir sonidos",
          "Fabricar semillas sin flores",
          "Absorber agua y ayudar a fijar la planta",
          "Convertir rocas en luz"
        ],
        "correctAnswer": "Absorber agua y ayudar a fijar la planta",
        "explanation": "Las raíces absorben agua y minerales del suelo, y contribuyen al anclaje de la planta.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-117",
        "number": 117,
        "topic": "Atmósfera",
        "concept": "ozono_estratosfera_absorbe_ultravioleta",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué capa de la atmósfera se concentra la mayor parte del ozono que absorbe radiación ultravioleta?",
        "options": [
          "Troposfera",
          "Mesosfera",
          "Exosfera",
          "Estratosfera"
        ],
        "correctAnswer": "Estratosfera",
        "explanation": "La capa de ozono se encuentra principalmente en la estratosfera y absorbe gran parte de la radiación ultravioleta solar.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-118",
        "number": 118,
        "topic": "Calor",
        "concept": "corrientes_conveccion_agua_calentada",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué fenómeno puede hacer que el agua de una olla circule al calentarse desde el fondo?",
        "options": [
          "Convección",
          "Reflexión",
          "Magnetismo",
          "Condensación"
        ],
        "correctAnswer": "Convección",
        "explanation": "Al calentarse desde abajo, el agua caliente asciende y la más fría desciende, formando corrientes de convección.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-119",
        "number": 119,
        "topic": "Ciencia",
        "concept": "atmosfera_lunar_extremadamente_tenue",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "La Luna tiene una atmósfera densa, parecida a la de la Tierra.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "La Luna posee una exosfera extremadamente tenue, no una atmósfera densa como la terrestre.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-120",
        "number": 120,
        "topic": "Astronomía",
        "concept": "meteoro_destello_entrada_atmosfera",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama el destello que produce un fragmento espacial al entrar en la atmósfera?",
        "options": [
          "Meteorito",
          "Meteoro",
          "Asteroide",
          "Cometa"
        ],
        "correctAnswer": "Meteoro",
        "explanation": "El meteoro es el destello observado cuando un meteoroide atraviesa la atmósfera; si un fragmento llega al suelo, se llama meteorito.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-121",
        "number": 121,
        "topic": "Electricidad",
        "concept": "bombillas_conectadas_en_serie",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos bombillas están en una sola ruta eléctrica. Al retirar una, ambas se apagan. ¿Cómo están conectadas?",
        "options": [
          "En paralelo",
          "Sin circuito",
          "En serie",
          "En una red inalámbrica"
        ],
        "correctAnswer": "En serie",
        "explanation": "En un circuito en serie, los componentes comparten una sola ruta; si se interrumpe, la corriente deja de circular por todos.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-122",
        "number": 122,
        "topic": "Ecología",
        "concept": "migracion_aves_busca_recursos",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Durante una estación seca, algunas aves se desplazan desde un humedal con poco alimento hacia otro con más insectos. ¿Qué ventaja puede tener ese movimiento?",
        "options": [
          "Acceder a más alimento",
          "Evitar competencia en cualquier lugar",
          "Reproducirse sin alimento",
          "Garantizar la supervivencia individual"
        ],
        "correctAnswer": "Acceder a más alimento",
        "explanation": "Desplazarse puede permitir a las aves encontrar recursos disponibles en otro lugar; la migración no elimina todas las dificultades ambientales.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-123",
        "number": 123,
        "topic": "Propiedades de materiales",
        "concept": "dilatacion_termica_afloja_tapa_metalica",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Al calentar una tapa metálica, esta se dilata un poco. ¿Qué cambio podría facilitar abrir un frasco con tapa atascada?",
        "options": [
          "Enfriar la tapa para contraerla",
          "Mojarla para que se evapore",
          "Girar el frasco sin sujetarlo",
          "Calentar la tapa para que se dilate"
        ],
        "correctAnswer": "Calentar la tapa para que se dilate",
        "explanation": "Al calentarse, el metal se expande ligeramente; ese cambio puede aflojar la tapa respecto al frasco.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-124",
        "number": 124,
        "topic": "Sistema respiratorio",
        "concept": "ejercicio_aumenta_demanda_oxigeno",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Al correr, los músculos suelen necesitar más oxígeno que cuando el cuerpo está en reposo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "Durante el ejercicio aumenta la actividad muscular y el cuerpo incrementa el intercambio de gases para responder a esa demanda.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-125",
        "number": 125,
        "topic": "Ecosistemas",
        "concept": "turbidez_reduce_luz_para_plantas_acuaticas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "El agua de un lago se vuelve muy turbia después de una tormenta. ¿Qué efecto podría tener en las plantas acuáticas?",
        "options": [
          "Producirían luz propia",
          "Recibirían menos luz para fotosintetizar",
          "Dejarían de necesitar agua",
          "Se convertirían en animales"
        ],
        "correctAnswer": "Recibirían menos luz para fotosintetizar",
        "explanation": "Las partículas suspendidas pueden reducir la luz que llega a las plantas acuáticas y dificultar la fotosíntesis.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-126",
        "number": 126,
        "topic": "Materiales",
        "concept": "transparencia_deja_pasar_luz_visible",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué material deja pasar la mayor parte de la luz y permite ver con claridad a través de él?",
        "options": [
          "Vidrio transparente",
          "Cartón",
          "Madera",
          "Lámina de aluminio"
        ],
        "correctAnswer": "Vidrio transparente",
        "explanation": "Un material transparente deja pasar la luz y permite distinguir con claridad los objetos que están detrás.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-127",
        "number": 127,
        "topic": "Cuerpo humano",
        "concept": "cerebro_coordina_respuestas_nerviosas",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué órgano coordina muchas respuestas del sistema nervioso?",
        "options": [
          "Estómago",
          "Cerebro",
          "Pulmón",
          "Riñón"
        ],
        "correctAnswer": "Cerebro",
        "explanation": "El cerebro procesa información y coordina numerosas respuestas del cuerpo junto con otras partes del sistema nervioso.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-128",
        "number": 128,
        "topic": "Ciclos de vida",
        "concept": "etapa_crisalida_mariposa",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué etapa sigue normalmente a la oruga en el ciclo de vida de una mariposa?",
        "options": [
          "Huevo",
          "Adulto",
          "Crisálida",
          "Semilla"
        ],
        "correctAnswer": "Crisálida",
        "explanation": "En la metamorfosis completa, la mariposa pasa de huevo a larva, luego a crisálida y finalmente a adulto.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-129",
        "number": 129,
        "topic": "Tierra y océanos",
        "concept": "gravedad_lunar_contribuye_mareas",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La atracción gravitatoria de la Luna contribuye a producir las mareas terrestres.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La gravedad lunar influye en los océanos; el Sol también contribuye a las mareas.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-130",
        "number": 130,
        "topic": "Sistema solar",
        "concept": "jupiter_planeta_mayor_tamano",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es el planeta más grande del sistema solar?",
        "options": [
          "Tierra",
          "Neptuno",
          "Saturno",
          "Júpiter"
        ],
        "correctAnswer": "Júpiter",
        "explanation": "Júpiter es el planeta de mayor tamaño del sistema solar.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-131",
        "number": 131,
        "topic": "Energía y espacio",
        "concept": "radiacion_transfiere_energia_en_vacio",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo llega principalmente el calor del Sol a la Tierra a través del espacio?",
        "options": [
          "Radiación",
          "Conducción",
          "Convección",
          "Evaporación"
        ],
        "correctAnswer": "Radiación",
        "explanation": "La radiación puede viajar por el vacío; la conducción y la convección requieren materia.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-132",
        "number": 132,
        "topic": "Medición",
        "concept": "newton_unidad_medicion_fuerza",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es la unidad de fuerza en el sistema internacional?",
        "options": [
          "Grado Celsius",
          "Newton",
          "Watt",
          "Metro"
        ],
        "correctAnswer": "Newton",
        "explanation": "La fuerza se mide en newtons; el watt mide potencia y el metro, longitud.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-133",
        "number": 133,
        "topic": "Propiedades del agua",
        "concept": "punto_ebullicion_depende_presion",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "El agua pura hierve siempre exactamente a 100 °C, sin importar la presión del aire.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso",
        "explanation": "El punto de ebullición cambia con la presión atmosférica; a menor presión, el agua hierve a menor temperatura.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-134",
        "number": 134,
        "topic": "Sonido",
        "concept": "frecuencia_mayor_sonido_agudo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos sonidos tienen igual volumen, pero uno es más agudo. ¿Qué propiedad es mayor en el sonido agudo?",
        "options": [
          "Amplitud",
          "Duración",
          "Frecuencia",
          "Distancia"
        ],
        "correctAnswer": "Frecuencia",
        "explanation": "Un sonido más agudo tiene mayor frecuencia; el volumen se relaciona principalmente con la amplitud.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-135",
        "number": 135,
        "topic": "Atmósfera",
        "concept": "anemometro_mide_velocidad_viento",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué instrumento permite medir la velocidad del viento?",
        "options": [
          "Barómetro",
          "Anemómetro",
          "Pluviómetro",
          "Termómetro"
        ],
        "correctAnswer": "Anemómetro",
        "explanation": "Un anemómetro mide la velocidad del viento; el barómetro mide presión y el pluviómetro recoge precipitación.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-136",
        "number": 136,
        "topic": "Cambios químicos",
        "concept": "combustion_madera_forma_sustancias_nuevas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál situación produce una sustancia nueva?",
        "options": [
          "Cortar una hoja de papel",
          "Derretir un cubo de hielo",
          "Disolver sal en agua",
          "Quemar un trozo de madera"
        ],
        "correctAnswer": "Quemar un trozo de madera",
        "explanation": "Al quemarse, la madera reacciona y forma sustancias distintas, como gases y ceniza.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-137",
        "number": 137,
        "topic": "Geología",
        "concept": "corteza_capa_solida_externa_tierra",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama la capa sólida más externa de la Tierra?",
        "options": [
          "Corteza",
          "Manto",
          "Núcleo externo",
          "Núcleo interno"
        ],
        "correctAnswer": "Corteza",
        "explanation": "La corteza es la capa sólida más externa de la Tierra; debajo se encuentra el manto.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-138",
        "number": 138,
        "topic": "Magnetismo",
        "concept": "brujula_se_alinea_campo_terrestre",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una brújula puede orientarse porque su aguja responde al campo magnético de la Tierra.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La aguja imantada se alinea aproximadamente con el campo magnético terrestre.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-139",
        "number": 139,
        "topic": "Tierra y espacio",
        "concept": "orbita_terrestre_dura_un_ano",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué movimiento de la Tierra dura aproximadamente un año?",
        "options": [
          "Una rotación sobre su eje",
          "Una órbita alrededor del Sol",
          "Una vuelta de la Luna alrededor de la Tierra",
          "Un cambio de fase lunar"
        ],
        "correctAnswer": "Una órbita alrededor del Sol",
        "explanation": "La Tierra completa una órbita alrededor del Sol en aproximadamente un año.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-140",
        "number": 140,
        "topic": "Biología",
        "concept": "falta_luz_afecta_crecimiento_plantas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una planta crece con tallos delgados y pálidos después de permanecer mucho tiempo en oscuridad. ¿Qué explicación es más probable?",
        "options": [
          "Recibió demasiada luz",
          "Absorbió demasiados minerales",
          "Le faltó luz para crecer normalmente",
          "Produjo alimento en exceso"
        ],
        "correctAnswer": "Le faltó luz para crecer normalmente",
        "explanation": "La luz es necesaria para la fotosíntesis; sin ella, muchas plantas presentan crecimiento débil y pérdida de color.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-141",
        "number": 141,
        "topic": "Cuerpo humano",
        "concept": "arterias_llevan_sangre_desde_corazon",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué vasos sanguíneos llevan la sangre desde el corazón hacia el cuerpo?",
        "options": [
          "Venas",
          "Capilares",
          "Alvéolos",
          "Arterias"
        ],
        "correctAnswer": "Arterias",
        "explanation": "Las arterias conducen la sangre desde el corazón; las venas la llevan de regreso.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-142",
        "number": 142,
        "topic": "Fuerzas",
        "concept": "area_mayor_reduce_presion_correas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué las correas anchas de una mochila pueden resultar más cómodas que las estrechas?",
        "options": [
          "Reparten la fuerza sobre un área mayor",
          "Eliminan el peso de la mochila",
          "Aumentan la gravedad sobre los hombros",
          "Reducen la masa de los objetos"
        ],
        "correctAnswer": "Reparten la fuerza sobre un área mayor",
        "explanation": "Al distribuir la fuerza sobre un área mayor, disminuye la presión en cada punto del hombro.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-143",
        "number": 143,
        "topic": "Sonido",
        "concept": "amplitud_mayor_sonido_mas_intenso",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Al aumentar la amplitud de un sonido, normalmente se percibe más fuerte.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La amplitud se relaciona con la intensidad percibida; la frecuencia se relaciona principalmente con el tono.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-144",
        "number": 144,
        "topic": "Máquinas simples",
        "concept": "plano_inclinado_reduce_fuerza_aumenta_distancia",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una rampa permite subir una caja aplicando menos fuerza que al levantarla verticalmente. ¿Qué ventaja ofrece principalmente?",
        "options": [
          "Elimina el peso de la caja",
          "Reduce la fuerza necesaria a cambio de recorrer más distancia",
          "Cambia la caja por una palanca",
          "Hace que la gravedad deje de actuar"
        ],
        "correctAnswer": "Reduce la fuerza necesaria a cambio de recorrer más distancia",
        "explanation": "Un plano inclinado permite aplicar una fuerza menor a lo largo de una distancia mayor.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-145",
        "number": 145,
        "topic": "Tierra sólida",
        "concept": "magma_enfria_roca_ignea_intrusiva",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué puede formar una roca cuando el magma se enfría y solidifica bajo la superficie?",
        "options": [
          "Roca sedimentaria",
          "Combustible fósil",
          "Roca ígnea",
          "Suelo orgánico"
        ],
        "correctAnswer": "Roca ígnea",
        "explanation": "El magma que se enfría bajo tierra forma roca ígnea intrusiva; si sale a la superficie se denomina lava.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-146",
        "number": 146,
        "topic": "Interpretación de datos",
        "concept": "grafico_lineas_cambio_temperatura_tiempo",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una estudiante mide la temperatura del agua cada minuto mientras se calienta. ¿Qué gráfico permite observar mejor cómo cambia con el tiempo?",
        "options": [
          "Un gráfico de líneas",
          "Un mapa de carreteras",
          "Un dibujo sin escala",
          "Una lista de nombres"
        ],
        "correctAnswer": "Un gráfico de líneas",
        "explanation": "Un gráfico de líneas muestra cómo cambia una medida continua, como la temperatura, a medida que transcurre el tiempo.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-147",
        "number": 147,
        "topic": "Sonido",
        "concept": "eco_reflexion_sonido_superficie",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una persona aplaude cerca de una pared y escucha el sonido otra vez. ¿Qué ocurrió principalmente?",
        "options": [
          "Se refractó al atravesar la pared",
          "Se difractó alrededor de la pared",
          "Fue absorbido por la pared",
          "Se reflejó en la pared"
        ],
        "correctAnswer": "Se reflejó en la pared",
        "explanation": "Una superficie puede reflejar el sonido y hacer que regrese como eco si llega con suficiente demora.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-148",
        "number": 148,
        "topic": "Diseño experimental",
        "concept": "comparar_retencion_agua_suelos_controlando_condiciones",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Se quiere comparar qué suelo retiene más agua. ¿Qué procedimiento permite una comparación más justa?",
        "options": [
          "Usar cantidades distintas de cada suelo",
          "Verter agua sin medir",
          "Poner cada suelo en recipientes de tamaño distinto",
          "Usar la misma masa de suelo, volumen de agua y tiempo de espera"
        ],
        "correctAnswer": "Usar la misma masa de suelo, volumen de agua y tiempo de espera",
        "explanation": "Mantener iguales las condiciones y medir el agua retenida permite atribuir mejor la diferencia al tipo de suelo.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-149",
        "number": 149,
        "topic": "Astronomía",
        "concept": "luz_estelar_tiempo_de_viaje",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "La luz de una estrella distante puede haber viajado mucho tiempo antes de llegar a la Tierra.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero",
        "explanation": "La luz tiene una velocidad muy alta, pero las estrellas están tan lejos que puede tardar años o mucho más en llegar.",
        "stability": "STABLE"
      },
      {
        "id": "CIE6-150",
        "number": 150,
        "topic": "Electricidad",
        "concept": "diagnosticar_contacto_circuito_linterna",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una linterna no enciende aunque la pila sea nueva. ¿Qué revisión sencilla conviene hacer primero?",
        "options": [
          "Cambiar el color de la carcasa",
          "Sacudirla para producir electricidad",
          "Comprobar que la bombilla haga contacto y el circuito esté cerrado",
          "Cubrir la bombilla con papel"
        ],
        "correctAnswer": "Comprobar que la bombilla haga contacto y el circuito esté cerrado",
        "explanation": "Un contacto flojo o un circuito abierto impiden que circule corriente hasta la bombilla.",
        "stability": "STABLE"
      }
    ]
  },
  {
    "catalogId": "edusyn-geografia-grade-6-v1",
    "title": "Geografía · 6.º",
    "grade": 6,
    "subjectArea": "Duelos",
    "category": "Geografía",
    "version": "1.0",
    "availability": "institution-opt-in",
    "editorialStatus": "ready-for-import",
    "audit": {
      "questions": 150,
      "multipleChoice": 120,
      "trueFalse": 30,
      "difficulty": {
        "basic": 50,
        "intermediate": 70,
        "application": 30
      },
      "answerPositions": {
        "A": 30,
        "B": 30,
        "C": 30,
        "D": 30
      },
      "conceptsPresent": 150,
      "conceptsMissing": 0
    },
    "sources": [
      "https://marine.weather.gov/glossary.php?word=isohyet",
      "https://md.water.usgs.gov/preview/faq/groundwater.html",
      "https://www.usgs.gov/news/science-snippet/earthword-alluvial-fan",
      "https://www.usgs.gov/faqs/what-a-topographic-map",
      "https://www.usgs.gov/faqs/how-are-different-map-projections-used",
      "https://www.eia.gov/energyexplained/hydropower/",
      "https://tsunami.coast.noaa.gov/",
      "https://vlab.noaa.gov/web/oclo/gamma",
      "https://pubs.usgs.gov/pp/0437a/report.pdf",
      "https://www.usgs.gov/water-science-school/science/watersheds-and-drainage-basins"
    ],
    "questions": [
      {
        "id": "GEO6-001",
        "number": 1,
        "topic": "Coordenadas geográficas",
        "concept": "latitud_posicion_norte_sur_ecuador",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué indican principalmente las líneas de latitud?",
        "options": [
          "La distancia al norte o al sur del ecuador",
          "La distancia al este o al oeste de Greenwich",
          "La altura sobre el nivel del mar",
          "La profundidad de los océanos"
        ],
        "correctAnswer": "La distancia al norte o al sur del ecuador",
        "explanation": "La latitud indica la posición angular al norte o al sur del ecuador.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-002",
        "number": 2,
        "topic": "Coordenadas geográficas",
        "concept": "longitud_referencia_meridiano_greenwich",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Desde qué meridiano se mide la longitud geográfica?",
        "options": [
          "El ecuador",
          "Greenwich",
          "El trópico de Cáncer",
          "El círculo polar ártico"
        ],
        "correctAnswer": "Greenwich",
        "explanation": "La longitud se mide hacia el este o el oeste desde el meridiano de Greenwich.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-003",
        "number": 3,
        "topic": "Mapas",
        "concept": "leyenda_explica_simbolos_mapa",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué información suele mostrar la leyenda de un mapa?",
        "options": [
          "La fecha de nacimiento de quien lo dibujó",
          "El tamaño real de cada objeto",
          "El significado de sus símbolos y colores",
          "La temperatura de cada lugar"
        ],
        "correctAnswer": "El significado de sus símbolos y colores",
        "explanation": "La leyenda explica qué representan los signos, colores y símbolos usados en el mapa.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-004",
        "number": 4,
        "topic": "Mapas físicos",
        "concept": "colores_verdes_altitud_baja_mapa_fisico",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En muchos mapas físicos, ¿qué suelen indicar los tonos de verde en zonas terrestres?",
        "options": [
          "Profundidad del océano",
          "Límites departamentales",
          "Intensidad del viento",
          "Tierras de menor altitud"
        ],
        "correctAnswer": "Tierras de menor altitud",
        "explanation": "Los colores hipsométricos suelen representar alturas; los verdes frecuentemente señalan zonas bajas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-005",
        "number": 5,
        "topic": "Continentes y océanos",
        "concept": "oceano_pacifico_mayor_extension",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es el océano de mayor extensión?",
        "options": [
          "Pacífico",
          "Atlántico",
          "Índico",
          "Ártico"
        ],
        "correctAnswer": "Pacífico",
        "explanation": "El océano Pacífico es el más extenso del planeta.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-006",
        "number": 6,
        "topic": "Tierra y movimiento",
        "concept": "rotacion_terrestre_dia_noche",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La rotación de la Tierra produce la alternancia entre el día y la noche.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Al girar sobre su eje, distintas partes de la Tierra quedan iluminadas por el Sol y luego pasan a la oscuridad.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-007",
        "number": 7,
        "topic": "Escala cartográfica",
        "concept": "escala_mapa_conversion_distancia",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En un mapa, 1 cm representa 10 km. ¿Qué distancia real representan 3 cm?",
        "options": [
          "13 km",
          "30 km",
          "300 km",
          "3 km"
        ],
        "correctAnswer": "30 km",
        "explanation": "Si cada centímetro representa 10 km, tres centímetros representan 30 km.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-008",
        "number": 8,
        "topic": "Colombia",
        "concept": "costas_colombia_caribe_y_pacifico",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Colombia tiene costas tanto en el mar Caribe como en el océano Pacífico.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "El territorio colombiano tiene costa en ambos cuerpos de agua.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-009",
        "number": 9,
        "topic": "Coordenadas geográficas",
        "concept": "paralelos_reducen_circunferencia_hacia_polos",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ocurre con las líneas de latitud a medida que se acercan a los polos?",
        "options": [
          "Se convierten en meridianos",
          "Se alejan del ecuador y se cruzan",
          "Se mantienen paralelas y sus círculos se hacen menores",
          "Desaparecen en los trópicos"
        ],
        "correctAnswer": "Se mantienen paralelas y sus círculos se hacen menores",
        "explanation": "Los paralelos no se cruzan; su circunferencia disminuye al acercarse a los polos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-010",
        "number": 10,
        "topic": "Relieve",
        "concept": "curvas_nivel_juntas_pendiente_empinada",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué indican las curvas de nivel muy juntas en un mapa topográfico?",
        "options": [
          "Una zona plana",
          "Un río ancho",
          "Una costa baja",
          "Una pendiente pronunciada"
        ],
        "correctAnswer": "Una pendiente pronunciada",
        "explanation": "Cuando las curvas de nivel están cerca unas de otras, la altura cambia en poca distancia horizontal.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-011",
        "number": 11,
        "topic": "Población",
        "concept": "densidad_poblacion_habitantes_superficie",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una región tiene 2.000 habitantes por cada km². ¿Qué describe esa medida?",
        "options": [
          "Densidad de población",
          "Tasa de natalidad",
          "Altitud media",
          "Extensión del territorio"
        ],
        "correctAnswer": "Densidad de población",
        "explanation": "La densidad de población relaciona cuántas personas viven en una unidad de superficie.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-012",
        "number": 12,
        "topic": "Ríos y relieve",
        "concept": "delta_deposito_sedimentos_desembocadura",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama el depósito de sedimentos que puede formarse donde un río desemboca en un cuerpo de agua?",
        "options": [
          "Acantilado",
          "Delta",
          "Meseta",
          "Istmo"
        ],
        "correctAnswer": "Delta",
        "explanation": "Al disminuir la velocidad en su desembocadura, un río puede depositar sedimentos y formar un delta.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-013",
        "number": 13,
        "topic": "Formas del relieve",
        "concept": "peninsula_tierra_rodeada_parcialmente_agua",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué forma de terreno está rodeada de agua por tres lados y unida al continente por uno?",
        "options": [
          "Isla",
          "Golfo",
          "Península",
          "Archipiélago"
        ],
        "correctAnswer": "Península",
        "explanation": "Una península es una porción de tierra rodeada parcialmente por agua y conectada al continente.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-014",
        "number": 14,
        "topic": "Colombia",
        "concept": "llanuras_orinoquia_oriente_colombia",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál región natural colombiana se caracteriza por extensas llanuras al este de los Andes?",
        "options": [
          "Insular",
          "Pacífica",
          "Andina",
          "Orinoquía"
        ],
        "correctAnswer": "Orinoquía",
        "explanation": "La Orinoquía comprende amplias llanuras orientales que drenan hacia la cuenca del Orinoco.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-015",
        "number": 15,
        "topic": "Clima",
        "concept": "clima_patrones_largo_plazo_vs_tiempo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué diferencia describe mejor el clima y el tiempo atmosférico?",
        "options": [
          "Clima: patrones largos; tiempo: condiciones actuales",
          "Clima: solo montañas; tiempo: solo costas",
          "Clima: diario; tiempo: de varias décadas",
          "Clima y tiempo: la misma medición"
        ],
        "correctAnswer": "Clima: patrones largos; tiempo: condiciones actuales",
        "explanation": "El tiempo se refiere a condiciones de corto plazo; el clima resume patrones observados durante periodos largos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-016",
        "number": 16,
        "topic": "Orientación",
        "concept": "orientacion_este_frente_oeste_espalda",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Al amanecer, una persona mira hacia el lugar por donde sale el Sol. ¿Qué punto cardinal tiene a su espalda?",
        "options": [
          "Sur",
          "Oeste",
          "Norte",
          "Este"
        ],
        "correctAnswer": "Oeste",
        "explanation": "El Sol sale aproximadamente por el este; al mirar hacia allí, el oeste queda detrás.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-017",
        "number": 17,
        "topic": "Mapas",
        "concept": "meridianos_convergen_en_polos",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Las líneas de longitud se encuentran en los polos.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Los meridianos convergen en los polos y se separan hacia el ecuador.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-018",
        "number": 18,
        "topic": "Colombia",
        "concept": "rio_magdalena_desemboca_caribe",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Hacia qué océano fluye principalmente el río Magdalena?",
        "options": [
          "Pacífico",
          "Índico",
          "Atlántico, por el mar Caribe",
          "Ártico"
        ],
        "correctAnswer": "Atlántico, por el mar Caribe",
        "explanation": "El Magdalena desemboca en el mar Caribe, parte del océano Atlántico.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-019",
        "number": 19,
        "topic": "Geografía humana",
        "concept": "gps_ubicacion_con_senales_satelitales",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un teléfono calcula su ubicación a partir de señales de satélites. ¿Qué sistema utiliza?",
        "options": [
          "Brújula",
          "Barómetro",
          "Sistema de información geográfica",
          "GPS"
        ],
        "correctAnswer": "GPS",
        "explanation": "El GPS usa señales de satélites para estimar la ubicación mediante coordenadas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-020",
        "number": 20,
        "topic": "Colombia",
        "concept": "rio_amazonas_recorrido_sur_colombia",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El río Amazonas atraviesa el sur de Colombia y continúa hacia Brasil.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "El río Amazonas recorre parte del extremo sur colombiano antes de seguir por Brasil.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-021",
        "number": 21,
        "topic": "Relieve",
        "concept": "elegir_terreno_elevado_fuera_planicie_inundable",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En un mapa topográfico, una familia quiere construir lejos de zonas bajas propensas a inundarse. ¿Qué lugar sería más prudente elegir?",
        "options": [
          "Parte baja de la ribera",
          "Cauce seco de quebrada",
          "Depresión sin salida de agua",
          "Terraza alta lejos del cauce"
        ],
        "correctAnswer": "Terraza alta lejos del cauce",
        "explanation": "Un sitio elevado y alejado del cauce suele reducir la exposición a inundaciones; también se deben revisar riesgos locales.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-022",
        "number": 22,
        "topic": "Coordenadas geográficas",
        "concept": "desplazamiento_norte_aumenta_latitud",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un viajero se desplaza desde el ecuador hacia el norte sin cambiar de meridiano. ¿Qué ocurre con su latitud?",
        "options": [
          "Se mantiene en cero",
          "Aumenta hacia el norte",
          "Cambia de longitud, no de latitud",
          "Se vuelve negativa en todo el recorrido"
        ],
        "correctAnswer": "Aumenta hacia el norte",
        "explanation": "La latitud aumenta desde 0° en el ecuador hasta 90° norte en el polo norte.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-023",
        "number": 23,
        "topic": "Costas y temperatura",
        "concept": "mar_modera_cambios_temperatura_costera",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una ciudad costera suele tener cambios de temperatura menos extremos que una ciudad interior cercana. ¿Qué factor ayuda a explicarlo?",
        "options": [
          "La costa recibe luz solo de noche",
          "El agua cambia de temperatura más rápido que la tierra",
          "El mar se calienta y se enfría más lentamente que el suelo",
          "La latitud deja de influir junto al mar"
        ],
        "correctAnswer": "El mar se calienta y se enfría más lentamente que el suelo",
        "explanation": "El agua se calienta y enfría más lentamente que la tierra, lo que puede moderar las temperaturas costeras.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-024",
        "number": 24,
        "topic": "Mapas",
        "concept": "conversion_escala_uno_a_cien_mil",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "En un mapa a escala 1:100.000, un centímetro representa un kilómetro en el terreno.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "A esa escala, 1 cm en el mapa equivale a 100.000 cm en la realidad, es decir, 1 km.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-025",
        "number": 25,
        "topic": "Proyecciones cartográficas",
        "concept": "proyeccion_plana_distorsiona_areas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una proyección como Mercator muestra Groenlandia casi tan grande como África. ¿Qué cautela debe tener quien la interpreta?",
        "options": [
          "La proyección puede distorsionar las áreas",
          "Groenlandia tiene el área real de África",
          "Los continentes están dibujados a escala idéntica",
          "La forma rectangular garantiza tamaños reales"
        ],
        "correctAnswer": "La proyección puede distorsionar las áreas",
        "explanation": "Al representar una superficie curva en un plano, algunas proyecciones distorsionan el tamaño relativo de las regiones.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-026",
        "number": 26,
        "topic": "Orientación",
        "concept": "rosa_vientos_indica_puntos_cardinales",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué muestra una rosa de los vientos?",
        "options": [
          "Puntos cardinales",
          "Alturas del terreno",
          "Límites políticos",
          "Distancias reales"
        ],
        "correctAnswer": "Puntos cardinales",
        "explanation": "La rosa de los vientos indica direcciones como norte, sur, este y oeste.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-027",
        "number": 27,
        "topic": "Cuadrículas cartográficas",
        "concept": "cuadrícula_ubicacion_columna_fila",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "En una cuadrícula, las columnas tienen letras y las filas números. ¿Cómo se señala una celda?",
        "options": [
          "Con una escala y una altura",
          "Con una letra y un número",
          "Con dos puntos cardinales",
          "Con latitud y temperatura"
        ],
        "correctAnswer": "Con una letra y un número",
        "explanation": "La combinación de columna y fila permite ubicar una celda, por ejemplo C4.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-028",
        "number": 28,
        "topic": "Continentes",
        "concept": "asia_continente_mayor_extension",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál es el continente de mayor extensión?",
        "options": [
          "África",
          "América",
          "Asia",
          "Europa"
        ],
        "correctAnswer": "Asia",
        "explanation": "Asia es el continente más extenso por superficie.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-029",
        "number": 29,
        "topic": "Tierra y hemisferios",
        "concept": "ecuador_division_hemisferios_norte_sur",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué línea divide la Tierra en hemisferios norte y sur?",
        "options": [
          "Meridiano de Greenwich",
          "Trópico de Capricornio",
          "Círculo polar ártico",
          "Ecuador"
        ],
        "correctAnswer": "Ecuador",
        "explanation": "El ecuador, situado en 0° de latitud, separa los hemisferios norte y sur.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-030",
        "number": 30,
        "topic": "Mapas políticos",
        "concept": "mapa_politico_muestra_limites_territoriales",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Un mapa político puede mostrar fronteras entre países y divisiones internas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Los mapas políticos representan territorios y límites administrativos; sus detalles dependen de la escala.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-031",
        "number": 31,
        "topic": "Ríos",
        "concept": "afluente_desemboca_en_rio_principal",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama un río o arroyo que desemboca en otro río?",
        "options": [
          "Estuario",
          "Delta",
          "Meandro",
          "Afluente"
        ],
        "correctAnswer": "Afluente",
        "explanation": "Un afluente vierte sus aguas en un río principal.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-032",
        "number": 32,
        "topic": "Relieve",
        "concept": "llanura_superficie_extensa_poco_inclinada",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué describe mejor una llanura?",
        "options": [
          "Terreno rodeado por agua",
          "Superficie extensa y poco inclinada",
          "Valle estrecho entre montañas",
          "Elevación aislada de gran altura"
        ],
        "correctAnswer": "Superficie extensa y poco inclinada",
        "explanation": "Una llanura es un terreno amplio con relieve relativamente plano o de poca pendiente.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-033",
        "number": 33,
        "topic": "Representaciones geográficas",
        "concept": "atlas_coleccion_organizada_de_mapas",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué reúne normalmente un atlas?",
        "options": [
          "Fotografías de una sola ciudad",
          "Instrucciones para usar una brújula",
          "Colección organizada de mapas",
          "Relatos de exploradores"
        ],
        "correctAnswer": "Colección organizada de mapas",
        "explanation": "Un atlas es una colección de mapas organizada en un libro o formato digital.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-034",
        "number": 34,
        "topic": "Navegación",
        "concept": "brujula_norte_magnetico_no_es_polo_geografico",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una brújula siempre apunta exactamente al polo norte geográfico.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso.  ",
        "explanation": "La brújula responde al campo magnético terrestre, cuyo norte no coincide exactamente con el polo geográfico.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-035",
        "number": 35,
        "topic": "Formas del relieve",
        "concept": "istmo_conecta_masas_terrestres",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué forma de terreno conecta dos áreas continentales y queda entre dos cuerpos de agua?",
        "options": [
          "Istmo",
          "Península",
          "Archipiélago",
          "Bahía"
        ],
        "correctAnswer": "Istmo",
        "explanation": "Un istmo es una franja estrecha de tierra que une dos masas terrestres y separa aguas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-036",
        "number": 36,
        "topic": "Coordenadas geográficas",
        "concept": "desplazamiento_este_mismo_paralelo_cambia_longitud",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una persona avanza hacia el este siguiendo el mismo paralelo. ¿Qué cambia principalmente?",
        "options": [
          "La altitud",
          "La longitud",
          "La latitud",
          "La distancia al ecuador"
        ],
        "correctAnswer": "La longitud",
        "explanation": "Al desplazarse por el mismo paralelo, la latitud se mantiene y cambia la longitud.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-037",
        "number": 37,
        "topic": "Cuencas hidrográficas",
        "concept": "cuenca_area_drenada_hacia_salida_comun",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué caracteriza principalmente una cuenca hidrográfica?",
        "options": [
          "El cauce por el que circula el río principal",
          "La longitud total de los ríos de la región",
          "El área que aporta agua a una salida común",
          "El punto donde el río llega a otro cuerpo de agua"
        ],
        "correctAnswer": "El área que aporta agua a una salida común",
        "explanation": "Una cuenca hidrográfica es el terreno desde el que el agua drena hacia un río, lago u otra salida común.  ",
        "stability": "STABLE",
        "source": "https://www.usgs.gov/water-science-school/science/watersheds-and-drainage-basins"
      },
      {
        "id": "GEO6-038",
        "number": 38,
        "topic": "Escala cartográfica",
        "concept": "escala_grande_muestra_area_menor_mas_detalle",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué suele mostrar un mapa a escala 1:10.000 frente a uno a 1:1.000.000?",
        "options": [
          "Más territorio y menos detalle",
          "El mismo territorio con idéntico detalle",
          "Un territorio mayor con más detalle",
          "Un área menor con más detalle"
        ],
        "correctAnswer": "Un área menor con más detalle",
        "explanation": "Una escala grande como 1:10.000 representa menos superficie con mayor detalle.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-039",
        "number": 39,
        "topic": "Mapas temáticos",
        "concept": "mapa_tematico_muestra_distribucion_precipitacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué permite comparar principalmente un mapa de precipitación?",
        "options": [
          "La distribución espacial de la lluvia",
          "La edad de las rocas",
          "Los límites de los municipios",
          "La profundidad del suelo"
        ],
        "correctAnswer": "La distribución espacial de la lluvia",
        "explanation": "Un mapa temático representa un fenómeno específico, como la precipitación, en distintos lugares.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-040",
        "number": 40,
        "topic": "Globo terráqueo",
        "concept": "globo_muestra_superficie_curva_sin_aplanar",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Un globo representa la superficie curva terrestre sin extenderla sobre un plano rectangular.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "A diferencia de un mapa plano, el globo conserva la forma esférica general de la Tierra.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-041",
        "number": 41,
        "topic": "Colombia: hidrografía",
        "concept": "rios_llanos_colombianos_cuenca_orinoco",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Hacia qué gran cuenca drenan muchos ríos de los Llanos orientales colombianos?",
        "options": [
          "Cuenca del Amazonas",
          "Cuenca del Orinoco",
          "Cuenca del Magdalena",
          "Cuenca del Atrato"
        ],
        "correctAnswer": "Cuenca del Orinoco",
        "explanation": "Los ríos de la Orinoquía colombiana hacen parte, en gran medida, de la cuenca del Orinoco.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-042",
        "number": 42,
        "topic": "Geografía humana",
        "concept": "mapa_coropletico_densidad_poblacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un mapa usa tonos más oscuros para lugares con más habitantes por km², según su leyenda. ¿Qué representa?",
        "options": [
          "El crecimiento anual",
          "La población total del país",
          "La densidad de población",
          "La migración entre ciudades"
        ],
        "correctAnswer": "La densidad de población",
        "explanation": "La densidad expresa la cantidad de habitantes en relación con una superficie determinada.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-043",
        "number": 43,
        "topic": "Proyecciones cartográficas",
        "concept": "mercator_conserva_angulos_locales",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué propiedad de Mercator facilita trazar rumbos de brújula en una carta náutica?",
        "options": [
          "Conserva el área de todos los continentes",
          "Elimina cualquier distorsión",
          "Mantiene el tamaño real de las regiones polares",
          "Conserva ángulos locales"
        ],
        "correctAnswer": "Conserva ángulos locales",
        "explanation": "Mercator conserva ángulos locales, aunque distorsiona mucho las áreas cerca de los polos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-044",
        "number": 44,
        "topic": "Mapas topográficos",
        "concept": "curva_nivel_conecta_igual_elevacion",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Cada curva de nivel une puntos que tienen la misma elevación.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Las curvas de nivel conectan lugares de igual altura sobre el nivel de referencia del mapa.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-045",
        "number": 45,
        "topic": "Orientación cartográfica",
        "concept": "longitud_este_mediodia_solar_local",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos ciudades están en una latitud similar, pero una queda mucho más al este. ¿Cuál alcanza primero el mediodía solar?",
        "options": [
          "La ciudad más al este",
          "La ciudad más al oeste",
          "La ciudad de mayor altitud",
          "La ciudad más cercana al ecuador"
        ],
        "correctAnswer": "La ciudad más al este",
        "explanation": "Debido a la rotación terrestre, los lugares más al este llegan antes al mediodía solar local.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-046",
        "number": 46,
        "topic": "Mapas urbanos",
        "concept": "ruta_urbana_considera_red_y_obstaculos",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En un plano, una línea recta hacia el hospital cruza un río sin puente. ¿Qué conviene hacer?",
        "options": [
          "Buscar un puente en calles conectadas",
          "Seguir la línea recta sobre el agua",
          "Elegir la ruta más corta sin cruces",
          "Ignorar el río y medir la distancia directa"
        ],
        "correctAnswer": "Buscar un puente en calles conectadas",
        "explanation": "Una ruta posible depende de la red de calles y cruces; la distancia recta no siempre es transitable.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-047",
        "number": 47,
        "topic": "Orientación",
        "concept": "mapa_girado_flecha_norte_derecha_borde_superior_oeste",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En un mapa girado, la flecha del norte apunta hacia la derecha de la página. ¿Hacia dónde queda el borde superior?",
        "options": [
          "Norte",
          "Oeste",
          "Este",
          "Sur"
        ],
        "correctAnswer": "Oeste",
        "explanation": "Si el norte queda a la derecha, al girar 90° en sentido antihorario desde esa dirección se encuentra el oeste en el borde superior.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-048",
        "number": 48,
        "topic": "Uso del suelo",
        "concept": "comparacion_temporal_mapas_cambio_uso_suelo",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos mapas del mismo lugar, separados por diez años, muestran menos bosque y más cultivos. ¿Qué conclusión apoyan?",
        "options": [
          "La región se volvió más alta",
          "El río cambió de cuenca",
          "Cambió el uso del suelo",
          "Aumentó la distancia entre pueblos"
        ],
        "correctAnswer": "Cambió el uso del suelo",
        "explanation": "La comparación temporal muestra una transformación de cobertura forestal a terreno cultivado, aunque no identifica por sí sola sus causas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-049",
        "number": 49,
        "topic": "Mapas topográficos",
        "concept": "elegir_mapa_topografico_para_altura_y_pendiente",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una caminante necesita conocer las alturas y pendientes de un sendero. ¿Qué mapa le sirve más?",
        "options": [
          "Mapa político",
          "Mapa de población",
          "Mapa de carreteras",
          "Mapa topográfico"
        ],
        "correctAnswer": "Mapa topográfico",
        "explanation": "Un mapa topográfico representa elevaciones y formas del terreno, a menudo mediante curvas de nivel.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-050",
        "number": 50,
        "topic": "Fuentes cartográficas",
        "concept": "fecha_mapa_importa_para_vigencia_de_datos",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Un mapa antiguo puede representar correctamente cómo eran las calles cuando se elaboró, aunque ya hayan cambiado.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "La fecha importa: un mapa puede ser preciso para su época y estar desactualizado para orientarse hoy.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-051",
        "number": 51,
        "topic": "Formas del relieve",
        "concept": "meseta_superficie_plana_elevada",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué caracteriza principalmente una meseta?",
        "options": [
          "Superficie elevada y relativamente plana",
          "Terreno bajo entre dos laderas",
          "Franja estrecha entre dos mares",
          "Grupo de islas cercanas"
        ],
        "correctAnswer": "Superficie elevada y relativamente plana",
        "explanation": "Una meseta es una extensión relativamente plana situada a mayor altura que las tierras vecinas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-052",
        "number": 52,
        "topic": "Islas",
        "concept": "archipielago_conjunto_de_islas",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cómo se llama un conjunto de islas relacionadas entre sí?",
        "options": [
          "Península",
          "Archipiélago",
          "Istmo",
          "Estrecho"
        ],
        "correctAnswer": "Archipiélago",
        "explanation": "Un archipiélago es un grupo o conjunto de islas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-053",
        "number": 53,
        "topic": "Costas",
        "concept": "estrecho_paso_angosto_de_agua",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué es un estrecho?",
        "options": [
          "Entrada amplia del mar en la costa",
          "Línea que separa dos países",
          "Paso angosto de agua entre tierras",
          "Franja de tierra que une continentes"
        ],
        "correctAnswer": "Paso angosto de agua entre tierras",
        "explanation": "Un estrecho es un paso de agua relativamente angosto entre dos masas de tierra.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-054",
        "number": 54,
        "topic": "América del Sur",
        "concept": "andes_recorrido_borde_occidental_sudamerica",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué borde de Sudamérica se extiende principalmente la cordillera de los Andes?",
        "options": [
          "Norte",
          "Este",
          "Centro",
          "Oeste"
        ],
        "correctAnswer": "Oeste",
        "explanation": "Los Andes recorren el borde occidental de Sudamérica, junto al océano Pacífico.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-055",
        "number": 55,
        "topic": "Costas",
        "concept": "gravedad_lunar_y_solar_influye_mareas",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "La gravedad de la Luna y del Sol influye en las mareas oceánicas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "La atracción gravitacional de ambos astros participa en las mareas; la Luna tiene la influencia mayor.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-056",
        "number": 56,
        "topic": "Glaciares",
        "concept": "glaciar_masa_hielo_terrestre_en_movimiento",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué describe mejor un glaciar?",
        "options": [
          "Masa de hielo terrestre que fluye lentamente",
          "Lago salado formado en una costa",
          "Río cálido que nace en un desierto",
          "Capa de nubes que cubre una montaña"
        ],
        "correctAnswer": "Masa de hielo terrestre que fluye lentamente",
        "explanation": "Los glaciares son masas de hielo en tierra que se deforman y desplazan lentamente por gravedad.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-057",
        "number": 57,
        "topic": "África",
        "concept": "sahara_ubicacion_continente_africa",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué continente se encuentra el desierto del Sahara?",
        "options": [
          "Europa",
          "África",
          "Asia",
          "América del Sur"
        ],
        "correctAnswer": "África",
        "explanation": "El Sahara se extiende por una amplia zona del norte de África.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-058",
        "number": 58,
        "topic": "Ramas de la geografía",
        "concept": "geografia_humana_poblacion_asentamientos_actividades",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué estudia principalmente la geografía humana?",
        "options": [
          "Minerales y capas de roca",
          "Formas del relieve y volcanes",
          "Población, asentamientos y actividades",
          "Instrumentos para medir terremotos"
        ],
        "correctAnswer": "Población, asentamientos y actividades",
        "explanation": "La geografía humana estudia cómo se distribuyen las personas y sus actividades en el espacio.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-059",
        "number": 59,
        "topic": "Relieve y lluvia",
        "concept": "barlovento_ascenso_aire_y_precipitacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "El aire húmedo asciende por una montaña y se enfría. ¿Qué ladera suele recibir más lluvia?",
        "options": [
          "Barlovento",
          "Sotavento",
          "La más seca del valle",
          "La que mira al ecuador"
        ],
        "correctAnswer": "Barlovento",
        "explanation": "En la ladera de barlovento, el aire húmedo asciende, se enfría y puede condensarse.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-060",
        "number": 60,
        "topic": "Altitud y temperatura",
        "concept": "aumento_altitud_suele_reducir_temperatura",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos pueblos están a una latitud parecida. Uno se encuentra mucho más alto. ¿Qué condición es más probable allí?",
        "options": [
          "Temperatura promedio mayor",
          "Temperatura promedio menor",
          "Igual temperatura en toda estación",
          "Ausencia total de viento"
        ],
        "correctAnswer": "Temperatura promedio menor",
        "explanation": "En general, la temperatura disminuye con la altitud, aunque otros factores locales también influyen.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-061",
        "number": 61,
        "topic": "Mapas meteorológicos",
        "concept": "isobara_conecta_igual_presion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué une una isóbara en un mapa del tiempo?",
        "options": [
          "Lugares con igual lluvia",
          "Puntos de igual altura",
          "Lugares con igual presión atmosférica",
          "Puntos con igual profundidad marina"
        ],
        "correctAnswer": "Lugares con igual presión atmosférica",
        "explanation": "Una isóbara conecta puntos que tienen la misma presión atmosférica.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-062",
        "number": 62,
        "topic": "Procesos costeros",
        "concept": "olas_depositan_arena_formacion_playa",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Cuando las olas pierden energía y depositan arena junto a la costa, ¿qué forma puede crecer?",
        "options": [
          "Acantilado",
          "Cañón",
          "Volcán",
          "Playa"
        ],
        "correctAnswer": "Playa",
        "explanation": "La acumulación de sedimentos transportados por el agua contribuye a formar playas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-063",
        "number": 63,
        "topic": "Tectónica",
        "concept": "terremotos_concentracion_limites_placas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué zonas ocurren muchos terremotos?",
        "options": [
          "Cerca de los límites entre placas",
          "Solo en el centro de continentes",
          "Exclusivamente en las costas bajas",
          "Únicamente dentro de los desiertos"
        ],
        "correctAnswer": "Cerca de los límites entre placas",
        "explanation": "Muchos terremotos se concentran cerca de límites de placas, aunque también pueden ocurrir dentro de ellas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-064",
        "number": 64,
        "topic": "Arrecifes",
        "concept": "arrecifes_coralinos_ambiente_marino_calido_somero",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué ambiente suelen desarrollarse muchos arrecifes coralinos?",
        "options": [
          "Aguas profundas, frías y oscuras",
          "Aguas cálidas, poco profundas y claras",
          "Ríos rápidos de montaña",
          "Lagos de agua dulce"
        ],
        "correctAnswer": "Aguas cálidas, poco profundas y claras",
        "explanation": "Muchos arrecifes constructores prosperan en aguas marinas cálidas, claras y poco profundas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-065",
        "number": 65,
        "topic": "Desiertos",
        "concept": "desierto_definido_por_aridez_no_por_calor",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Todos los desiertos tienen temperaturas altas durante todo el año.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso.  ",
        "explanation": "Un desierto se define sobre todo por su escasa precipitación; existen desiertos fríos y con estaciones distintas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-066",
        "number": 66,
        "topic": "Geografía humana",
        "concept": "urbanizacion_aumento_poblacion_urbana",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué proceso describe el aumento de la proporción de personas que vive en ciudades?",
        "options": [
          "Erosión",
          "Desertificación",
          "Urbanización",
          "Sedimentación"
        ],
        "correctAnswer": "Urbanización",
        "explanation": "La urbanización implica el crecimiento de las ciudades o de la proporción de población que vive en ellas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-067",
        "number": 67,
        "topic": "Relieve kárstico",
        "concept": "disolucion_caliza_formacion_relieve_karstico",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El agua puede disolver lentamente la roca caliza y contribuir a formar cuevas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "En terrenos de caliza, el agua disuelve parte de la roca y puede desarrollar formas kársticas, como cuevas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-068",
        "number": 68,
        "topic": "Localización relativa",
        "concept": "ubicacion_relativa_referencias_cercanas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "“La escuela está al norte de la plaza y cerca del río” describe principalmente una ubicación:",
        "options": [
          "Absoluta",
          "Astronómica",
          "Hipsométrica",
          "Relativa"
        ],
        "correctAnswer": "Relativa",
        "explanation": "La ubicación relativa indica dónde está un lugar en relación con otros sitios o referencias.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-069",
        "number": 69,
        "topic": "Corrientes marinas",
        "concept": "corriente_marina_influencia_condiciones_costeras",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una corriente marina fría puede influir en las condiciones de las costas cercanas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Las corrientes transportan agua y calor, por lo que pueden afectar el ambiente costero según la región.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-070",
        "number": 70,
        "topic": "Movimientos en masa",
        "concept": "deslizamiento_desplazamiento_gravedad_pendiente",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué proceso desplaza suelo o roca cuesta abajo por efecto de la gravedad?",
        "options": [
          "Erosión",
          "Deposición",
          "Infiltración",
          "Deslizamiento"
        ],
        "correctAnswer": "Deslizamiento",
        "explanation": "Un deslizamiento es un tipo de movimiento en masa que desplaza materiales por una pendiente.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-071",
        "number": 71,
        "topic": "Planeación urbana",
        "concept": "planeacion_hospital_combina_demanda_y_accesibilidad",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una ciudad busca ubicar un hospital de emergencias para atender a más barrios. ¿Qué información conviene combinar?",
        "options": [
          "Población y red vial",
          "Relieve y tipos de roca",
          "Precipitación y vegetación",
          "Altitud y cuencas"
        ],
        "correctAnswer": "Población y red vial",
        "explanation": "La distribución de habitantes y las vías ayudan a estimar demanda y acceso, junto con otros criterios de seguridad y servicio.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-072",
        "number": 72,
        "topic": "Conservación del suelo",
        "concept": "cobertura_y_curvas_nivel_reducen_escorrentia",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En una ladera cultivada, ¿qué práctica ayuda a reducir la pérdida de suelo por escorrentía?",
        "options": [
          "Retirar cobertura y arar cuesta abajo",
          "Conservar plantas y arar en contorno",
          "Canalizar agua hacia la pendiente",
          "Quitar vegetación antes de las lluvias"
        ],
        "correctAnswer": "Conservar plantas y arar en contorno",
        "explanation": "La cobertura vegetal y los surcos a nivel pueden reducir la velocidad con que el agua baja por la pendiente.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-073",
        "number": 73,
        "topic": "Riesgo costero",
        "concept": "retroceso_costero_planificacion_retiro_exposicion",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una comunidad observa que el borde de la costa retrocede y consulta un mapa de riesgo. ¿Qué decisión es más prudente?",
        "options": [
          "Reubicar obras junto al borde costero",
          "Aplazar obras sin cambiar el sitio",
          "Alejar obras nuevas de la zona expuesta",
          "Rellenar la costa sin estudio local"
        ],
        "correctAnswer": "Alejar obras nuevas de la zona expuesta",
        "explanation": "Respetar zonas expuestas y planear retiros reduce la exposición, aunque la decisión requiere estudios y normas locales.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-074",
        "number": 74,
        "topic": "Páramos colombianos",
        "concept": "conservacion_paramo_protege_regulacion_hidrica",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una comunidad depende del agua que nace en un páramo. ¿Qué acción favorece mejor el abastecimiento a largo plazo?",
        "options": [
          "Reforestar zonas bajas lejos de nacimientos",
          "Extender ganadería hacia la parte alta",
          "Drenar humedales para ampliar cultivos",
          "Proteger vegetación y nacimientos de agua"
        ],
        "correctAnswer": "Proteger vegetación y nacimientos de agua",
        "explanation": "Los páramos ayudan a regular y almacenar agua; conservar su cobertura protege ese servicio ecosistémico.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-075",
        "number": 75,
        "topic": "Comparación de mapas",
        "concept": "comparacion_cobertura_controla_area_y_escala",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Para comparar cambios de cobertura entre dos mapas, conviene mantener iguales el área y la escala representadas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Usar el mismo recorte y escala ayuda a comparar áreas de forma justa; también se debe revisar la leyenda y la fecha.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-076",
        "number": 76,
        "topic": "Población",
        "concept": "poblacion_absoluta_total_habitantes",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué representa la población absoluta de un territorio?",
        "options": [
          "Número total de habitantes",
          "Promedio de personas por km²",
          "Cantidad de viviendas por barrio",
          "Porcentaje de personas migrantes"
        ],
        "correctAnswer": "Número total de habitantes",
        "explanation": "La población absoluta es el total de personas que habita un territorio en un momento determinado.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-077",
        "number": 77,
        "topic": "Recursos y energía",
        "concept": "viento_recurso_energetico_renovable",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál fuente de energía se renueva de manera natural?",
        "options": [
          "Carbón",
          "Viento",
          "Petróleo",
          "Gas natural"
        ],
        "correctAnswer": "Viento",
        "explanation": "El viento es una fuente renovable; carbón, petróleo y gas natural son combustibles fósiles finitos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-078",
        "number": 78,
        "topic": "Regiones",
        "concept": "region_area_con_rasgos_o_conexiones_comunes",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué permite reconocer una región geográfica?",
        "options": [
          "Tener fronteras nacionales",
          "Contener ciudades del mismo tamaño",
          "Compartir un rasgo geográfico",
          "Tener habitantes con el mismo empleo"
        ],
        "correctAnswer": "Compartir un rasgo geográfico",
        "explanation": "Una región puede reconocerse por características comunes o por las conexiones entre sus lugares.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-079",
        "number": 79,
        "topic": "Migración",
        "concept": "migracion_interna_mismo_pais",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "Una familia se muda de un municipio a otro dentro del mismo país. ¿Qué tipo de migración realiza?",
        "options": [
          "Internacional",
          "Intercontinental",
          "Transoceánica",
          "Interna"
        ],
        "correctAnswer": "Interna",
        "explanation": "La migración interna ocurre dentro de las fronteras de un mismo país.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-080",
        "number": 80,
        "topic": "Asentamientos",
        "concept": "coexistencia_asentamientos_rurales_y_urbanos",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Un país puede tener asentamientos rurales y urbanos.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "En un mismo país coexisten lugares rurales y ciudades, con distintas actividades y formas de ocupación.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-081",
        "number": 81,
        "topic": "Actividades económicas",
        "concept": "sector_primario_obtencion_productos_naturaleza",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué actividad pertenece principalmente al sector primario?",
        "options": [
          "Cultivar café",
          "Tostar café en una fábrica",
          "Vender café en una tienda",
          "Diseñar una campaña para café"
        ],
        "correctAnswer": "Cultivar café",
        "explanation": "El sector primario obtiene productos o recursos directamente de la naturaleza, como los cultivos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-082",
        "number": 82,
        "topic": "Asentamientos urbanos",
        "concept": "asentamiento_urbano_concentracion_construcciones_servicios",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué rasgo suele distinguir a un asentamiento urbano?",
        "options": [
          "Viviendas muy dispersas y pocos servicios",
          "Mayor concentración de construcciones y servicios",
          "Ausencia completa de vías",
          "Actividades exclusivamente agrícolas"
        ],
        "correctAnswer": "Mayor concentración de construcciones y servicios",
        "explanation": "Las zonas urbanas suelen concentrar más edificaciones, población y servicios; hay excepciones según el lugar.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-083",
        "number": 83,
        "topic": "Intercambio regional",
        "concept": "comercio_intercambio_bienes_servicios_regiones",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué significa comercio entre regiones?",
        "options": [
          "Medir la altura de sus montañas",
          "Trazar sus límites políticos",
          "Intercambiar bienes o servicios",
          "Dividir sus territorios en cuadrículas"
        ],
        "correctAnswer": "Intercambiar bienes o servicios",
        "explanation": "El comercio conecta lugares mediante el intercambio de bienes y servicios.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-084",
        "number": 84,
        "topic": "Regiones funcionales",
        "concept": "region_funcional_vinculos_con_centro",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Personas de varios municipios viajan a diario a una ciudad para trabajar y acceder a servicios. ¿Qué tipo de región puede formar esa conexión?",
        "options": [
          "Región climática",
          "Región de relieve",
          "Región insular",
          "Región funcional"
        ],
        "correctAnswer": "Región funcional",
        "explanation": "Una región funcional se organiza alrededor de un centro conectado con lugares cercanos por actividades y desplazamientos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-085",
        "number": 85,
        "topic": "Ciudades y límites",
        "concept": "area_urbana_construida_cruza_limite_administrativo",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "El área construida de una ciudad se extiende más allá del límite de su municipio. ¿Qué conclusión es adecuada?",
        "options": [
          "El espacio urbano puede cruzar límites administrativos",
          "El municipio deja de tener un límite oficial",
          "Las viviendas pasan a ser rurales automáticamente",
          "Todas las personas viven dentro de una sola ciudad"
        ],
        "correctAnswer": "El espacio urbano puede cruzar límites administrativos",
        "explanation": "La expansión física de una zona construida no siempre coincide con los límites administrativos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-086",
        "number": 86,
        "topic": "Demografía",
        "concept": "piramide_poblacional_edad_y_sexo",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Una pirámide poblacional organiza datos por grupos de edad y sexo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Esta gráfica representa la composición de la población por edad y sexo, con grupos en cada lado.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-087",
        "number": 87,
        "topic": "Migración estacional",
        "concept": "migracion_estacional_labor_cosecha",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una persona se desplaza temporalmente a otra región durante la cosecha y luego regresa. ¿Qué movimiento describe mejor la situación?",
        "options": [
          "Migración internacional permanente",
          "Migración estacional",
          "Desplazamiento intercontinental",
          "Expansión urbana"
        ],
        "correctAnswer": "Migración estacional",
        "explanation": "La migración estacional se relaciona con actividades que requieren trabajadores durante una parte del año.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-088",
        "number": 88,
        "topic": "Factores de migración",
        "concept": "oferta_educativa_factor_atraccion_migratoria",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una ciudad ofrece estudios que no existen en el pueblo de origen. Para algunos jóvenes, esa oferta puede actuar como:",
        "options": [
          "Factor de expulsión",
          "Barrera física",
          "Factor de atracción",
          "Límite político"
        ],
        "correctAnswer": "Factor de atracción",
        "explanation": "Una oportunidad educativa puede atraer a personas hacia otro lugar, aunque cada decisión tenga varias causas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-089",
        "number": 89,
        "topic": "Sectores económicos",
        "concept": "sector_secundario_transformacion_materias_primas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una fábrica transforma madera en muebles. ¿A qué sector pertenece esa actividad?",
        "options": [
          "Primario",
          "Terciario",
          "Extractivo",
          "Secundario"
        ],
        "correctAnswer": "Secundario",
        "explanation": "El sector secundario transforma materias primas en productos elaborados o procesados.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-090",
        "number": 90,
        "topic": "Distribución de población",
        "concept": "total_poblacion_no_muestra_distribucion_espacial",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El total de habitantes de un país no indica por sí solo cómo se distribuyen entre sus regiones.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Para conocer la distribución espacial se necesitan datos por lugares, no solo el total nacional.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-091",
        "number": 91,
        "topic": "Localización económica",
        "concept": "industria_localizacion_cerca_materias_primas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una procesadora de minerales se instala junto a una mina. ¿Qué factor de localización aprovecha?",
        "options": [
          "Proximidad a materias primas",
          "Cercanía a mercados consumidores",
          "Acceso a mano de obra",
          "Conexión a vías de transporte"
        ],
        "correctAnswer": "Proximidad a materias primas",
        "explanation": "Estar cerca de los insumos puede reducir traslados y facilitar el abastecimiento de la planta.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-092",
        "number": 92,
        "topic": "Puertos e intercambio",
        "concept": "puerto_conexion_rutas_y_transporte_de_carga",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ventaja geográfica puede ofrecer un puerto conectado con rutas marítimas?",
        "options": [
          "Reducir automáticamente los impuestos",
          "Conectar barcos con transporte terrestre",
          "Eliminar por completo los costos",
          "Igualar los ingresos de las regiones"
        ],
        "correctAnswer": "Conectar barcos con transporte terrestre",
        "explanation": "Los puertos conectan transporte marítimo y terrestre, lo que puede facilitar el comercio de mercancías.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-093",
        "number": 93,
        "topic": "Pirámides poblacionales",
        "concept": "piramide_base_estrecha_menor_proporcion_infantil",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una pirámide, los grupos infantiles son más estrechos que los grupos adultos. ¿Qué indica directamente esa forma?",
        "options": [
          "Hay más niños que adultos",
          "Todas las edades tienen igual número",
          "La proporción infantil es menor que la adulta",
          "La población está repartida igual por regiones"
        ],
        "correctAnswer": "La proporción infantil es menor que la adulta",
        "explanation": "El ancho de cada grupo representa su tamaño relativo; una base más estrecha indica menos población infantil que en los grupos más anchos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-094",
        "number": 94,
        "topic": "Actividades de servicios",
        "concept": "sector_terciario_servicios_transporte",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Cuál actividad pertenece al sector terciario?",
        "options": [
          "Extraer carbón",
          "Cultivar arroz",
          "Fabricar muebles",
          "Transportar pasajeros"
        ],
        "correctAnswer": "Transportar pasajeros",
        "explanation": "El sector terciario reúne servicios, entre ellos transporte, comercio, salud y educación.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-095",
        "number": 95,
        "topic": "Movilidad y migración",
        "concept": "movilidad_diaria_no_implica_cambio_residencia",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Viajar cada día a otra ciudad para trabajar no significa necesariamente cambiar allí la residencia.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "El desplazamiento cotidiano puede conectar lugares sin que la persona se mude a vivir al sitio de trabajo.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-096",
        "number": 96,
        "topic": "Producción y mercados",
        "concept": "acopio_fruticola_cerca_produccion_y_vias",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una cosecha de fruta se daña en el trayecto hacia el mercado. ¿Dónde ayudaría más una central de acopio con refrigeración?",
        "options": [
          "Cerca de productores y vías de salida",
          "Lejos de fincas y carreteras",
          "En una zona sin conexión de transporte",
          "Junto a un destino sin comercio"
        ],
        "correctAnswer": "Cerca de productores y vías de salida",
        "explanation": "Acercar acopio y refrigeración a las zonas productoras conectadas puede reducir el tiempo de traslado y las pérdidas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-097",
        "number": 97,
        "topic": "Servicios educativos",
        "concept": "escuela_ubicacion_demanda_y_accesibilidad",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un municipio planea una escuela nueva. Tiene un mapa de los hogares con niños y otro de las rutas de transporte. ¿Qué sitio conviene evaluar primero?",
        "options": [
          "Un lugar aislado de las rutas",
          "Un punto cercano a los barrios y accesible",
          "Un terreno lejano sin viviendas",
          "Un sitio elegido solo por su altura"
        ],
        "correctAnswer": "Un punto cercano a los barrios y accesible",
        "explanation": "Combinar población atendida y acceso ayuda a proponer una ubicación útil; también deben revisarse seguridad y capacidad.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-098",
        "number": 98,
        "topic": "Conectividad territorial",
        "concept": "redundancia_vial_reduce_aislamiento_por_cierre",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un deslizamiento puede cerrar la única carretera que comunica varios pueblos. ¿Qué medida reduce mejor su aislamiento futuro?",
        "options": [
          "Aumentar la velocidad permitida",
          "Quitar las señales de desvío",
          "Planear una conexión alternativa segura",
          "Medir la carretera solo en línea recta"
        ],
        "correctAnswer": "Planear una conexión alternativa segura",
        "explanation": "Una ruta alternativa segura mantiene conexiones si el corredor principal se interrumpe.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-099",
        "number": 99,
        "topic": "Interdependencia regional",
        "concept": "intercambio_regional_producciones_complementarias",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una región produce alimentos y otra fabrica herramientas agrícolas. ¿Qué intercambio puede beneficiar a ambas?",
        "options": [
          "Enviar herramientas a una zona sin cultivos",
          "Evitar todo traslado entre regiones",
          "Producir los mismos bienes en cada lugar",
          "Intercambiar herramientas por alimentos"
        ],
        "correctAnswer": "Intercambiar herramientas por alimentos",
        "explanation": "El intercambio permite aprovechar producciones distintas y conectar necesidades entre regiones.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-100",
        "number": 100,
        "topic": "Límites de datos demográficos",
        "concept": "piramide_poblacional_no_muestra_localizacion",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Una pirámide poblacional muestra edades y sexos, pero no revela por sí sola dónde vive cada grupo.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "La pirámide resume composición demográfica; se requieren datos o mapas adicionales para localizar a la población.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-101",
        "number": 101,
        "topic": "Ecosistemas costeros",
        "concept": "manglar_ecosistema_costero_agua_salobre",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿En qué ambiente se encuentran muchos manglares?",
        "options": [
          "Cumbres frías sin influencia marina",
          "Desiertos alejados del mar",
          "Bosques boreales de clima frío",
          "Costas tropicales con agua salobre"
        ],
        "correctAnswer": "Costas tropicales con agua salobre",
        "explanation": "Los manglares crecen en costas tropicales y estuarios, donde algunas especies toleran cambios de salinidad.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-102",
        "number": 102,
        "topic": "Biomas",
        "concept": "sabana_pastizal_tropical_arboles_dispersos",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué vegetación es común en muchas sabanas tropicales?",
        "options": [
          "Hielo permanente",
          "Pastos con árboles dispersos",
          "Bosque de coníferas denso",
          "Musgos bajo el hielo"
        ],
        "correctAnswer": "Pastos con árboles dispersos",
        "explanation": "Las sabanas tropicales son pastizales cálidos, a menudo con árboles dispersos y temporadas lluviosas y secas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-103",
        "number": 103,
        "topic": "Biomas",
        "concept": "tundra_frio_y_vegetacion_baja",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué condición es característica de la tundra?",
        "options": [
          "Calor húmedo todo el año",
          "Bosque tropical muy denso",
          "Frío y vegetación baja",
          "Arrecifes coralinos extensos"
        ],
        "correctAnswer": "Frío y vegetación baja",
        "explanation": "El frío y la corta temporada de crecimiento limitan el desarrollo de árboles en muchas zonas de tundra.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-104",
        "number": 104,
        "topic": "Biodiversidad",
        "concept": "biodiversidad_variedad_vida_y_ecosistemas",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué significa biodiversidad?",
        "options": [
          "Cantidad de montañas de una región",
          "Número de carreteras por ciudad",
          "Tamaño de una sola población",
          "Variedad de seres vivos y ecosistemas"
        ],
        "correctAnswer": "Variedad de seres vivos y ecosistemas",
        "explanation": "La biodiversidad abarca la variedad de formas de vida, sus diferencias y los ecosistemas donde se encuentran.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-105",
        "number": 105,
        "topic": "Hábitats",
        "concept": "carretera_puede_fragmentar_habitat_continuo",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Una carretera que atraviesa un bosque continuo puede dividir el hábitat en partes separadas.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Una vía u otra barrera puede fragmentar un hábitat y separar los espacios usados por algunas especies.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-106",
        "number": 106,
        "topic": "Especies y territorio",
        "concept": "especie_endemica_distribucion_restringida",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué significa que una especie sea endémica de una región?",
        "options": [
          "Que vive de forma natural solo allí",
          "Que se encuentra en todos los continentes",
          "Que fue introducida por una carretera",
          "Que migra cada día a otra ciudad"
        ],
        "correctAnswer": "Que vive de forma natural solo allí",
        "explanation": "Una especie endémica es nativa y está restringida naturalmente a un área determinada.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-107",
        "number": 107,
        "topic": "Especies introducidas",
        "concept": "especie_invasora_no_nativa_se_propaga_y_dana",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué caracteriza a una especie invasora?",
        "options": [
          "Solo habita en reservas naturales",
          "Es introducida y puede propagarse causando daño",
          "Desaparece al cambiar de estación",
          "Es propia de todos los ecosistemas"
        ],
        "correctAnswer": "Es introducida y puede propagarse causando daño",
        "explanation": "Una especie no nativa se considera invasora cuando se propaga y perjudica ecosistemas, economía o salud.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-108",
        "number": 108,
        "topic": "Conectividad ecológica",
        "concept": "corredor_ecologico_conecta_parches_habitat",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué es un corredor de hábitat?",
        "options": [
          "Un camino pavimentado entre ciudades",
          "Un muro que divide una reserva",
          "Una franja natural que conecta hábitats",
          "Un límite entre dos municipios"
        ],
        "correctAnswer": "Una franja natural que conecta hábitats",
        "explanation": "La vegetación que conecta parches de hábitat puede facilitar el desplazamiento de algunas especies.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-109",
        "number": 109,
        "topic": "Estuarios",
        "concept": "estuario_mezcla_agua_dulce_y_marina",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ocurre en un estuario?",
        "options": [
          "Un glaciar cubre una montaña",
          "El viento forma dunas interiores",
          "Un río se convierte en desierto",
          "El agua dulce se mezcla con la marina"
        ],
        "correctAnswer": "El agua dulce se mezcla con la marina",
        "explanation": "Un estuario es una zona costera donde el agua de los ríos se mezcla con el agua del mar.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-110",
        "number": 110,
        "topic": "Humedales",
        "concept": "humedal_costero_retiene_agua_y_reduce_inundacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función puede cumplir un humedal costero?",
        "options": [
          "Retener agua y amortiguar inundaciones",
          "Detener por completo las mareas",
          "Impedir toda entrada de sedimentos",
          "Convertir agua salada en potable"
        ],
        "correctAnswer": "Retener agua y amortiguar inundaciones",
        "explanation": "Algunos humedales absorben o ralentizan el agua y ayudan a reducir inundaciones y erosión.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-111",
        "number": 111,
        "topic": "Ecosistemas costeros",
        "concept": "carbono_azul_ecosistemas_costeros",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué ecosistemas pueden almacenar carbono azul en sus plantas y suelos?",
        "options": [
          "Desiertos y sabanas secas",
          "Manglares, marismas y pastos marinos",
          "Tundras y glaciares interiores",
          "Montañas y bosques de coníferas"
        ],
        "correctAnswer": "Manglares, marismas y pastos marinos",
        "explanation": "Manglares, marismas y pastos marinos costeros pueden capturar y almacenar carbono en biomasa y sedimentos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-112",
        "number": 112,
        "topic": "Distribución de especies",
        "concept": "altitud_crea_condiciones_para_distribucion_vegetal",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una montaña, algunas plantas crecen arriba y otras más abajo. ¿Qué puede explicar ese patrón?",
        "options": [
          "El idioma de las poblaciones",
          "La distancia entre municipios",
          "Cambios de clima y condiciones con la altura",
          "El número de carreteras del país"
        ],
        "correctAnswer": "Cambios de clima y condiciones con la altura",
        "explanation": "La temperatura, humedad y suelo suelen cambiar con la altura, creando condiciones distintas para las especies.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-113",
        "number": 113,
        "topic": "Conectividad",
        "concept": "corredor_reconecta_habitats_separados",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Un corredor puede conectar dos hábitats que quedaron separados por terrenos transformados.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "La conectividad puede facilitar el desplazamiento entre parches, aunque su utilidad depende de cada especie y paisaje.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-114",
        "number": 114,
        "topic": "Turismo de naturaleza",
        "concept": "turismo_beneficios_economicos_y_presion_ambiental",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué combinación describe mejor un posible efecto del turismo en un ecosistema?",
        "options": [
          "Puede generar ingresos y también presión ambiental",
          "Siempre elimina los empleos locales",
          "No modifica ningún lugar visitado",
          "Garantiza que todas las especies aumenten"
        ],
        "correctAnswer": "Puede generar ingresos y también presión ambiental",
        "explanation": "El turismo puede apoyar empleos y conservación, pero el tránsito y la infraestructura también pueden afectar hábitats.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-115",
        "number": 115,
        "topic": "Invasiones biológicas",
        "concept": "especie_invasora_compite_con_especies_nativas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué efecto puede producir una especie invasora en un ecosistema?",
        "options": [
          "Crear límites entre países",
          "Competir con especies nativas por recursos",
          "Detener el movimiento de placas",
          "Evitar toda pérdida de hábitat"
        ],
        "correctAnswer": "Competir con especies nativas por recursos",
        "explanation": "Algunas invasoras compiten por alimento o espacio y pueden alterar las relaciones del ecosistema.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-116",
        "number": 116,
        "topic": "Pastos marinos",
        "concept": "pastos_marinos_estabilizan_fondo_y_ofrecen_habitat",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué función pueden cumplir los pastos marinos en zonas costeras?",
        "options": [
          "Formar montañas volcánicas",
          "Cambiar la latitud del litoral",
          "Estabilizar el fondo y servir de hábitat",
          "Convertir agua dulce en salada"
        ],
        "correctAnswer": "Estabilizar el fondo y servir de hábitat",
        "explanation": "Los pastos marinos pueden estabilizar el fondo y ofrecer alimento o refugio a distintas especies.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-117",
        "number": 117,
        "topic": "Conservación",
        "concept": "planear_vias_considerando_rutas_de_fauna",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Por qué conviene estudiar las rutas que usan los animales antes de construir una vía?",
        "options": [
          "Para aumentar la pendiente del terreno",
          "Para cambiar el curso de todos los ríos",
          "Para eliminar límites administrativos",
          "Para reducir cortes en sus desplazamientos"
        ],
        "correctAnswer": "Para reducir cortes en sus desplazamientos",
        "explanation": "Identificar rutas de movimiento permite evaluar pasos de fauna y otras medidas que reduzcan la fragmentación.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-118",
        "number": 118,
        "topic": "Estuarios",
        "concept": "aporte_agua_dulce_modifica_salinidad_estuario",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "Cambios en la cantidad de agua dulce que llega a un estuario pueden alterar sus condiciones de salinidad.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "La mezcla de agua dulce y marina define gradientes de salinidad que influyen en los hábitats del estuario.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-119",
        "number": 119,
        "topic": "Protección de hábitats",
        "concept": "reserva_aislada_evaluar_conectividad_ecologica",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Una reserva protege un bosque, pero está aislada por cultivos y carreteras. ¿Qué aspecto adicional conviene evaluar?",
        "options": [
          "La conectividad con otros hábitats",
          "El nombre del municipio vecino",
          "La distancia al ecuador solamente",
          "El tamaño de los edificios cercanos"
        ],
        "correctAnswer": "La conectividad con otros hábitats",
        "explanation": "Una reserva puede conservar un área, pero su conexión con otros hábitats también puede importar para ciertas especies.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-120",
        "number": 120,
        "topic": "Servicios ecosistémicos",
        "concept": "marisma_retiene_sedimentos_y_amortigua_oleaje",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "La vegetación de algunas marismas puede retener sedimentos y amortiguar el oleaje.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Las plantas y los sedimentos de marismas pueden ayudar a proteger orillas y servir de hábitat.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-121",
        "number": 121,
        "topic": "Planeación costera",
        "concept": "trazado_vial_evitar_habitat_manglar_sensible",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una carretera propuesta atravesaría un manglar que sirve de refugio a peces jóvenes. ¿Qué ajuste conviene evaluar?",
        "options": [
          "Rodear el área sensible y conservar conexiones naturales",
          "Ampliar la vía dentro del manglar",
          "Rellenar canales antes de estudiar el sitio",
          "Desviar todos los ríos hacia la carretera"
        ],
        "correctAnswer": "Rodear el área sensible y conservar conexiones naturales",
        "explanation": "Comparar alternativas que eviten hábitats sensibles puede reducir impactos; la decisión requiere estudios locales.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-122",
        "number": 122,
        "topic": "Restauración de hábitats",
        "concept": "restaurar_franja_vegetal_conecta_parches",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una carretera separó dos parches de bosque. ¿Qué proyecto podría mejorar la conexión ecológica?",
        "options": [
          "Ampliar el claro entre ambos",
          "Restaurar una franja vegetal que los una",
          "Retirar la vegetación de los bordes",
          "Construir más vías entre los parches"
        ],
        "correctAnswer": "Restaurar una franja vegetal que los una",
        "explanation": "Restaurar una franja de hábitat puede volver a conectar los parches, según las necesidades de las especies locales.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-123",
        "number": 123,
        "topic": "Uso público y conservación",
        "concept": "senderos_guiados_reducen_molestia_en_dunas",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una playa recibe visitantes y tiene dunas donde anidan aves. ¿Qué medida permite ordenar mejor las visitas?",
        "options": [
          "Permitir vehículos por toda la playa",
          "Retirar las señales de protección",
          "Guiar el tránsito por senderos fuera de zonas sensibles",
          "Iluminar toda la duna durante la noche"
        ],
        "correctAnswer": "Guiar el tránsito por senderos fuera de zonas sensibles",
        "explanation": "Delimitar senderos y proteger áreas de anidación puede reducir molestias sin cerrar necesariamente toda la costa.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-124",
        "number": 124,
        "topic": "Seguimiento ambiental",
        "concept": "comparar_cobertura_misma_zona_y_temporada",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Una comunidad compara imágenes de cobertura vegetal de dos años. ¿Qué condición mejora la comparación?",
        "options": [
          "Usar lugares distintos en cada imagen",
          "Ignorar las leyendas y las fechas",
          "Cambiar la escala sin registrarlo",
          "Comparar la misma zona y revisar la temporada"
        ],
        "correctAnswer": "Comparar la misma zona y revisar la temporada",
        "explanation": "Usar la misma zona y considerar la temporada ayuda a distinguir cambios duraderos de variaciones estacionales.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-125",
        "number": 125,
        "topic": "Áreas protegidas",
        "concept": "area_protegida_no_garantiza_conectividad_sola",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Declarar un área protegida garantiza por sí solo que las especies puedan desplazarse entre hábitats separados.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso.  ",
        "explanation": "La protección de un área no asegura conectividad; también pueden requerirse corredores y manejo del paisaje circundante.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-126",
        "number": 126,
        "topic": "Formas costeras",
        "concept": "bahia_entrada_amplia_del_mar_en_la_costa",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué es una bahía?",
        "options": [
          "Entrada del mar en la costa",
          "Elevación aislada en una llanura",
          "Paso angosto entre montañas",
          "Curso de agua bajo tierra"
        ],
        "correctAnswer": "Entrada del mar en la costa",
        "explanation": "Una bahía es una entrada amplia del mar en la costa, parcialmente rodeada por tierra.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-127",
        "number": 127,
        "topic": "Coordenadas",
        "concept": "coordenada_geografica_interseccion_paralelo_meridiano",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué dos líneas se cruzan para ubicar un punto con coordenadas geográficas?",
        "options": [
          "Dos ríos",
          "Un paralelo y un meridiano",
          "Una carretera y una frontera",
          "Dos curvas de nivel"
        ],
        "correctAnswer": "Un paralelo y un meridiano",
        "explanation": "La latitud se mide sobre los paralelos y la longitud sobre los meridianos; juntas localizan un punto.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-128",
        "number": 128,
        "topic": "Relieve costero",
        "concept": "acantilado_costa_abrupta_junto_al_mar",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué forma del relieve suele tener paredes altas y estrechas junto al mar?",
        "options": [
          "Delta",
          "Llanura aluvial",
          "Acantilado",
          "Duna"
        ],
        "correctAnswer": "Acantilado",
        "explanation": "Un acantilado es una costa abrupta que puede formarse por la erosión del oleaje.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-129",
        "number": 129,
        "topic": "Relieve fluvial",
        "concept": "meandro_curva_amplia_de_un_rio",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué forma una curva pronunciada de un río en una llanura?",
        "options": [
          "Glaciar",
          "Fiordo",
          "Cráter",
          "Meandro"
        ],
        "correctAnswer": "Meandro",
        "explanation": "Un meandro es una curva amplia del cauce, común en ríos que atraviesan terrenos de poca pendiente.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-130",
        "number": 130,
        "topic": "Aguas continentales",
        "concept": "lago_masa_de_agua_rodeada_de_tierra",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué es un lago?",
        "options": [
          "Cuerpo de agua rodeado de tierra",
          "Brazo de mar entre dos costas",
          "Río que solo aparece con lluvia",
          "Zona donde nace una cordillera"
        ],
        "correctAnswer": "Cuerpo de agua rodeado de tierra",
        "explanation": "Un lago es una masa de agua continental rodeada por tierra; puede recibir agua de ríos o lluvias.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-131",
        "number": 131,
        "topic": "Riesgos naturales",
        "concept": "sismo_submarino_puede_generar_tsunami",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué fenómeno puede producir olas muy grandes tras un sismo submarino?",
        "options": [
          "Tornado",
          "Tsunami",
          "Sequía",
          "Avalancha"
        ],
        "correctAnswer": "Tsunami",
        "explanation": "Un sismo bajo el mar puede desplazar grandes volúmenes de agua y generar un tsunami.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-132",
        "number": 132,
        "topic": "Territorio colombiano",
        "concept": "costa_norte_colombiana_mira_al_caribe",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué mar baña la costa norte de Colombia?",
        "options": [
          "Mar Mediterráneo",
          "Mar Negro",
          "Mar Caribe",
          "Mar de Japón"
        ],
        "correctAnswer": "Mar Caribe",
        "explanation": "La costa norte colombiana se extiende sobre el mar Caribe.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-133",
        "number": 133,
        "topic": "Clima y vegetación",
        "concept": "bosque_tropical_humedo_calor_y_lluvia_abundante",
        "difficulty": "BASIC",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué condición suele favorecer la presencia de bosques tropicales húmedos?",
        "options": [
          "Lluvias escasas casi todo el año",
          "Heladas permanentes",
          "Suelo cubierto de hielo",
          "Lluvias abundantes y temperaturas cálidas"
        ],
        "correctAnswer": "Lluvias abundantes y temperaturas cálidas",
        "explanation": "El calor y la disponibilidad de agua durante gran parte del año favorecen bosques tropicales húmedos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-134",
        "number": 134,
        "topic": "Geografía económica",
        "concept": "potencial_hidroelectrico_requiere_caudal_y_desnivel",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué combinación favorece la generación de energía hidroeléctrica?",
        "options": [
          "Un río caudaloso y un desnivel",
          "Un río con caudal escaso y un desnivel bajo",
          "Un río caudaloso en una llanura casi plana",
          "Un río estacional con poco caudal"
        ],
        "correctAnswer": "Un río caudaloso y un desnivel",
        "explanation": "El caudal y el desnivel permiten aprovechar el movimiento del agua para producir electricidad.  ",
        "stability": "STABLE",
        "source": "https://www.eia.gov/energyexplained/hydropower/"
      },
      {
        "id": "GEO6-135",
        "number": 135,
        "topic": "Orientación",
        "concept": "direccion_relativa_entre_dos_destinos_cardinales",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Desde un punto, una escuela está al norte y el río al este. ¿En qué dirección queda el río respecto a la escuela?",
        "options": [
          "Noroeste",
          "Sureste",
          "Suroeste",
          "Noreste"
        ],
        "correctAnswer": "Sureste",
        "explanation": "Si la escuela está al norte del punto y el río al este, desde la escuela el río queda hacia el sureste.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-136",
        "number": 136,
        "topic": "Relieve fluvial",
        "concept": "abanico_aluvial_deposito_en_pie_de_montana",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Un río sale de una zona montañosa, pierde velocidad y deposita sedimentos en forma de abanico. ¿Qué relieve puede formar?",
        "options": [
          "Un meandro",
          "Una bahía",
          "Un abanico aluvial",
          "Un acantilado"
        ],
        "correctAnswer": "Un abanico aluvial",
        "explanation": "Al salir de la montaña y perder energía, una corriente puede depositar sedimentos que se extienden en forma de abanico.  ",
        "stability": "STABLE",
        "source": "https://www.usgs.gov/news/science-snippet/earthword-alluvial-fan"
      },
      {
        "id": "GEO6-137",
        "number": 137,
        "topic": "Ríos",
        "concept": "cauce_efimero_responde_brevemente_a_precipitacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "En una zona seca, algunos cauces llevan agua brevemente solo después de lluvias. ¿Cómo se clasifican?",
        "options": [
          "Perennes",
          "Glaciares",
          "Subterráneos",
          "Efímeros"
        ],
        "correctAnswer": "Efímeros",
        "explanation": "Los cauces efímeros llevan agua durante poco tiempo como respuesta directa a la precipitación.  ",
        "stability": "STABLE",
        "source": "https://pubs.usgs.gov/pp/0437a/report.pdf"
      },
      {
        "id": "GEO6-138",
        "number": 138,
        "topic": "Estaciones",
        "concept": "inclinacion_eje_terrestre_produce_estaciones_opuestas",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "Dos ciudades, una al norte y otra al sur del ecuador, tienen estaciones opuestas. ¿Qué lo explica principalmente?",
        "options": [
          "La inclinación del eje terrestre orienta un hemisferio más hacia el Sol",
          "Los meridianos cambian la distancia entre ambas ciudades",
          "La rotación diaria desplaza las estaciones de un hemisferio al otro",
          "La Luna bloquea la luz solar durante varios meses"
        ],
        "correctAnswer": "La inclinación del eje terrestre orienta un hemisferio más hacia el Sol",
        "explanation": "Por la inclinación del eje terrestre, durante el recorrido anual un hemisferio recibe más luz directa mientras el otro recibe menos.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-139",
        "number": 139,
        "topic": "Aguas subterráneas",
        "concept": "acuifero_almacena_y_transmite_agua_subterranea",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué característica describe mejor un acuífero?",
        "options": [
          "Una corriente de aire entre montañas",
          "Una reserva de agua subterránea en rocas permeables",
          "Una capa de lava bajo un volcán",
          "Una zona donde se unen dos océanos"
        ],
        "correctAnswer": "Una reserva de agua subterránea en rocas permeables",
        "explanation": "Un acuífero es una formación geológica que almacena y transmite agua subterránea.  ",
        "stability": "STABLE",
        "source": "https://md.water.usgs.gov/preview/faq/groundwater.html"
      },
      {
        "id": "GEO6-140",
        "number": 140,
        "topic": "Regiones naturales",
        "concept": "region_natural_delimitada_por_rasgos_ambientales",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué rasgo distingue a una región natural de una división política?",
        "options": [
          "Se delimita solo por acuerdos entre gobiernos",
          "Siempre tiene una capital administrativa",
          "Se reconoce por rasgos físicos o ambientales compartidos",
          "Sus límites coinciden con los de cada municipio"
        ],
        "correctAnswer": "Se reconoce por rasgos físicos o ambientales compartidos",
        "explanation": "Una región natural agrupa espacios con características como clima, relieve, vegetación o hidrografía; no necesita coincidir con fronteras políticas.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-141",
        "number": 141,
        "topic": "Cartografía climática",
        "concept": "isoyeta_une_puntos_con_igual_precipitacion",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué línea de un mapa une lugares con la misma cantidad de lluvia?",
        "options": [
          "Isobara",
          "Isobata",
          "Isoterma",
          "Isoyeta"
        ],
        "correctAnswer": "Isoyeta",
        "explanation": "Una isoyeta une puntos que registran igual precipitación durante el periodo representado.  ",
        "stability": "STABLE",
        "source": "https://marine.weather.gov/glossary.php?word=isohyet"
      },
      {
        "id": "GEO6-142",
        "number": 142,
        "topic": "Ríos y relieve",
        "concept": "mayor_pendiente_aumenta_energia_y_erosion_del_rio",
        "difficulty": "INTERMEDIATE",
        "type": "MULTIPLE_CHOICE",
        "text": "¿Qué suele ocurrir con la velocidad de un río cuando aumenta mucho la pendiente de su cauce?",
        "options": [
          "Aumenta y puede erosionar más el lecho",
          "Disminuye hasta detenerse",
          "Se vuelve agua salada",
          "Cambia necesariamente de dirección hacia el norte"
        ],
        "correctAnswer": "Aumenta y puede erosionar más el lecho",
        "explanation": "Una pendiente mayor suele acelerar el flujo y aumentar su capacidad de erosionar el cauce.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-143",
        "number": 143,
        "topic": "Riesgo costero",
        "concept": "evacuacion_por_tsunami_hacia_terreno_elevado",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un mapa de evacuación muestra que el barrio está en una zona costera baja. ¿Hacia dónde conviene dirigir a las personas ante una alerta de tsunami?",
        "options": [
          "Hacia una playa más cercana",
          "Hacia terreno elevado y rutas señalizadas",
          "Hacia el borde del río",
          "Hacia edificios junto al mar"
        ],
        "correctAnswer": "Hacia terreno elevado y rutas señalizadas",
        "explanation": "Alejarse de la costa y llegar a terreno elevado por rutas de evacuación reduce la exposición a la inundación.  ",
        "stability": "STABLE",
        "source": "https://tsunami.coast.noaa.gov/"
      },
      {
        "id": "GEO6-144",
        "number": 144,
        "topic": "Relieve y transporte",
        "concept": "curvas_cerradas_con_cotas_ascendentes_indican_colina",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "En un mapa topográfico, varias curvas cerradas rodean un punto y las cotas aumentan hacia el centro. ¿Qué forma del relieve representan?",
        "options": [
          "Una depresión",
          "Un valle",
          "Una colina",
          "Una meseta"
        ],
        "correctAnswer": "Una colina",
        "explanation": "Las curvas cerradas con cotas más altas hacia el centro representan una elevación como una colina.  ",
        "stability": "STABLE",
        "source": "https://www.usgs.gov/faqs/what-a-topographic-map"
      },
      {
        "id": "GEO6-145",
        "number": 145,
        "topic": "Proyecciones cartográficas",
        "concept": "proyeccion_equivalente_conserva_proporciones_de_area",
        "difficulty": "APPLICATION",
        "type": "MULTIPLE_CHOICE",
        "text": "Un atlas compara el tamaño de varios países. ¿Qué tipo de proyección conviene para reducir la distorsión de sus áreas?",
        "options": [
          "Una que conserva únicamente las direcciones",
          "Una que conserva los ángulos locales",
          "Una que agranda las zonas polares",
          "Una proyección equivalente"
        ],
        "correctAnswer": "Una proyección equivalente",
        "explanation": "Las proyecciones equivalentes conservan las proporciones de área, aunque puedan deformar otras características.  ",
        "stability": "STABLE",
        "source": "https://www.usgs.gov/faqs/how-are-different-map-projections-used"
      },
      {
        "id": "GEO6-146",
        "number": 146,
        "topic": "",
        "concept": "agua_de_acuifero_puede_alimentar_manantiales_y_pozos",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Un acuífero puede alimentar manantiales o pozos cuando el agua subterránea llega a la superficie.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "El agua almacenada en formaciones permeables puede emerger de manera natural o extraerse mediante pozos.  ",
        "stability": "STABLE",
        "source": "https://md.water.usgs.gov/preview/faq/groundwater.html"
      },
      {
        "id": "GEO6-147",
        "number": 147,
        "topic": "",
        "concept": "valle_puede_facilitar_comunicacion_entre_elevaciones",
        "difficulty": "BASIC",
        "type": "TRUE_FALSE",
        "text": "Los valles pueden funcionar como corredores naturales de comunicación porque ofrecen pasos bajos entre elevaciones.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "En zonas montañosas, los valles suelen facilitar el tránsito entre lugares separados por elevaciones.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-148",
        "number": 148,
        "topic": "",
        "concept": "oleaje_erosiona_base_de_acantilado_y_retrocede_costa",
        "difficulty": "INTERMEDIATE",
        "type": "TRUE_FALSE",
        "text": "El oleaje puede erosionar la base de un acantilado y contribuir a que la costa retroceda.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "El impacto repetido de las olas desgasta la costa y puede hacer que el borde del acantilado avance tierra adentro.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-149",
        "number": 149,
        "topic": "",
        "concept": "ausencia_de_registros_en_mapa_no_demuestra_riesgo_nulo",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "Si un mapa muestra menos sismos en una zona, eso demuestra por sí solo que allí no ocurren terremotos.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Falso.  ",
        "explanation": "La ausencia de puntos puede deberse al periodo observado, a pocos registros o a la escala; el mapa no demuestra riesgo nulo.  ",
        "stability": "STABLE",
        "source": null
      },
      {
        "id": "GEO6-150",
        "number": 150,
        "topic": "",
        "concept": "falso_color_satelital_resalta_vegetacion_con_colores_asignados",
        "difficulty": "APPLICATION",
        "type": "TRUE_FALSE",
        "text": "En algunas imágenes satelitales se asignan colores para resaltar la vegetación, así que el color mostrado puede no ser el que vemos a simple vista.",
        "options": [
          "Verdadero",
          "Falso"
        ],
        "correctAnswer": "Verdadero.  ",
        "explanation": "Las composiciones de falso color combinan bandas de luz para facilitar la observación de ciertos rasgos del terreno.  ",
        "stability": "STABLE",
        "source": "https://vlab.noaa.gov/web/oclo/gamma"
      }
    ]
  }
];
