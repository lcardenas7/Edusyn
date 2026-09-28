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
  }
];
