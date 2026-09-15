// Study Buddies — single Cloudflare Worker
//
// Serves the static site from ./public (via the "assets" binding configured
// in wrangler.jsonc) and handles four API routes:
//   GET/PUT  /api/progress   shared per-topic status
//   GET/PUT  /api/plan       shared study-plan settings
//   GET/PUT  /api/activity   shared activity log
//   GET      /api/content    AI-generated summary/flashcards/quiz (cached in KV)
//
// Requires (set in wrangler.jsonc / dashboard):
//   - KV namespace bound as PROGRESS_KV
//   - Secret environment variable ANTHROPIC_API_KEY

const COURSES = {
  science: { label:"Combined Science", order:["bio", "chem", "phys", "prac"], groups:{
  bio: { label:"Biology", key:"bio", color:"#2FA6A6", topics:[
      { id:"4.1", title:"Cell biology", subs:[
        {id:"4.1.1", t:"Cell structure"},
        {id:"4.1.2", t:"Cell division"},
        {id:"4.1.3", t:"Transport in cells"}
      ]},
      { id:"4.2", title:"Organisation", subs:[
        {id:"4.2.1", t:"Principles of organisation"},
        {id:"4.2.2", t:"Animal tissues, organs and organ systems"},
        {id:"4.2.3", t:"Plant tissues, organs and systems"}
      ]},
      { id:"4.3", title:"Infection and response", subs:[
        {id:"4.3.1", t:"Communicable diseases"}
      ]},
      { id:"4.4", title:"Bioenergetics", subs:[
        {id:"4.4.1", t:"Photosynthesis"},
        {id:"4.4.2", t:"Respiration"}
      ]},
      { id:"4.5", title:"Homeostasis and response", subs:[
        {id:"4.5.1", t:"Homeostasis"},
        {id:"4.5.2", t:"The human nervous system"},
        {id:"4.5.3", t:"Hormonal coordination in humans"}
      ]},
      { id:"4.6", title:"Inheritance, variation and evolution", subs:[
        {id:"4.6.1", t:"Reproduction"},
        {id:"4.6.2", t:"Variation and evolution"},
        {id:"4.6.3", t:"Development of understanding of genetics and evolution"},
        {id:"4.6.4", t:"Classification of living organisms"}
      ]},
      { id:"4.7", title:"Ecology", subs:[
        {id:"4.7.1", t:"Adaptations, interdependence and competition"},
        {id:"4.7.2", t:"Organisation of an ecosystem"},
        {id:"4.7.3", t:"Biodiversity and human interaction with ecosystems"}
      ]}
    ]},
  chem: { label:"Chemistry", key:"chem", color:"#5B6FD8", topics:[
      { id:"5.1", title:"Atomic structure and the periodic table", subs:[
        {id:"5.1.1", t:"A simple model of the atom, symbols, relative atomic mass, isotopes"},
        {id:"5.1.2", t:"The periodic table"}
      ]},
      { id:"5.2", title:"Bonding, structure and the properties of matter", subs:[
        {id:"5.2.1", t:"Chemical bonds: ionic, covalent and metallic"},
        {id:"5.2.2", t:"How bonding and structure relate to properties"},
        {id:"5.2.3", t:"Structure and bonding of carbon"}
      ]},
      { id:"5.3", title:"Quantitative chemistry", subs:[
        {id:"5.3.1", t:"Chemical measurements, conservation of mass, quantitative equations"},
        {id:"5.3.2", t:"Amount of substance in relation to masses of pure substances"}
      ]},
      { id:"5.4", title:"Chemical changes", subs:[
        {id:"5.4.1", t:"Reactivity of metals"},
        {id:"5.4.2", t:"Reactions of acids"},
        {id:"5.4.3", t:"Electrolysis"}
      ]},
      { id:"5.5", title:"Energy changes", subs:[
        {id:"5.5.1", t:"Exothermic and endothermic reactions"}
      ]},
      { id:"5.6", title:"Rate and extent of chemical change", subs:[
        {id:"5.6.1", t:"Rate of reaction"},
        {id:"5.6.2", t:"Reversible reactions and dynamic equilibrium"}
      ]},
      { id:"5.7", title:"Organic chemistry", subs:[
        {id:"5.7.1", t:"Carbon compounds as fuels and feedstock"}
      ]},
      { id:"5.8", title:"Chemical analysis", subs:[
        {id:"5.8.1", t:"Purity, formulations and chromatography"},
        {id:"5.8.2", t:"Identification of common gases"}
      ]},
      { id:"5.9", title:"Chemistry of the atmosphere", subs:[
        {id:"5.9.1", t:"Composition and evolution of Earth's atmosphere"},
        {id:"5.9.2", t:"Carbon dioxide and methane as greenhouse gases"},
        {id:"5.9.3", t:"Common atmospheric pollutants and their sources"}
      ]},
      { id:"5.10", title:"Using resources", subs:[
        {id:"5.10.1", t:"Using Earth's resources and obtaining potable water"},
        {id:"5.10.2", t:"Life cycle assessment and recycling"}
      ]}
    ]},
  phys: { label:"Physics", key:"phys", color:"#38B6D9", topics:[
      { id:"6.1", title:"Energy", subs:[
        {id:"6.1.1", t:"Energy changes in a system, ways energy is stored"},
        {id:"6.1.2", t:"Conservation and dissipation of energy"},
        {id:"6.1.3", t:"National and global energy resources"}
      ]},
      { id:"6.2", title:"Electricity", subs:[
        {id:"6.2.1", t:"Current, potential difference and resistance"},
        {id:"6.2.2", t:"Series and parallel circuits"},
        {id:"6.2.3", t:"Domestic uses and safety"},
        {id:"6.2.4", t:"Energy transfers"}
      ]},
      { id:"6.3", title:"Particle model of matter", subs:[
        {id:"6.3.1", t:"Changes of state and the particle model"},
        {id:"6.3.2", t:"Internal energy and energy transfers"},
        {id:"6.3.3", t:"Particle model and pressure"}
      ]},
      { id:"6.4", title:"Atomic structure", subs:[
        {id:"6.4.1", t:"Atoms and isotopes"},
        {id:"6.4.2", t:"Atoms and nuclear radiation"}
      ]},
      { id:"6.5", title:"Forces", subs:[
        {id:"6.5.1", t:"Forces and their interactions"},
        {id:"6.5.2", t:"Work done and energy transfer"},
        {id:"6.5.3", t:"Forces and elasticity"},
        {id:"6.5.4", t:"Forces and motion"},
        {id:"6.5.5", t:"Momentum (HT only)"}
      ]},
      { id:"6.6", title:"Waves", subs:[
        {id:"6.6.1", t:"Waves in air, fluids and solids"},
        {id:"6.6.2", t:"Electromagnetic waves"}
      ]},
      { id:"6.7", title:"Magnetism and electromagnetism", subs:[
        {id:"6.7.1", t:"Permanent and induced magnetism, magnetic forces and fields"},
        {id:"6.7.2", t:"The motor effect"}
      ]}
    ]},
  prac: { label:"Required practicals", key:"prac", color:"#4A6FA5", topics:[
      { id:"RP", title:"20 required practical activities", subs:[
        {id:"RP1", t:"Observe, draw and label plant and animal cells (light microscope)"},
        {id:"RP2", t:"Effect of solute concentration on mass of plant tissue (osmosis)"},
        {id:"RP3", t:"Test food samples for sugars, starch, protein and lipids"},
        {id:"RP4", t:"Effect of pH on the rate of amylase activity"},
        {id:"RP5", t:"Effect of light intensity on rate of photosynthesis"},
        {id:"RP6", t:"Investigate a factor affecting human reaction time"},
        {id:"RP7", t:"Measure population size in a habitat (sampling techniques)"},
        {id:"RP8", t:"Prepare a pure, dry sample of a soluble salt"},
        {id:"RP9", t:"Electrolysis of aqueous solutions using inert electrodes"},
        {id:"RP10", t:"Temperature changes in reacting solutions"},
        {id:"RP11", t:"Effect of concentration on rate of reaction"},
        {id:"RP12", t:"Paper chromatography to separate/identify coloured substances"},
        {id:"RP13", t:"Analysis and purification of water samples"},
        {id:"RP15", t:"Factors affecting resistance of electrical circuits"},
        {id:"RP16", t:"I–V characteristics of circuit elements (lamp, diode, resistor)"},
        {id:"RP17", t:"Determine densities of regular/irregular solids and liquids"},
        {id:"RP18", t:"Relationship between force and extension of a spring"},
        {id:"RP19", t:"Effect of force on acceleration of an object (F=ma)"},
        {id:"RP20", t:"Frequency, wavelength and speed of waves"},
        {id:"RP21", t:"Infrared absorption/radiation and surface type"}
      ]}
    ]}
  } },
  maths: { label:"Maths", order:["number", "algebra", "ratio", "geometry", "probability", "statistics"], groups:{
  number: { label:"Number", key:"number", color:"#2FA6A6", topics:[
      { id:"3.1.1", title:"Structure and calculation", subs:[
        {id:"N1", t:"Ordering numbers & inequality symbols"},
        {id:"N2", t:"The four operations & place value"},
        {id:"N3", t:"Inverse operations & order of operations"},
        {id:"N4", t:"Primes, factors & multiples (HCF/LCM)"},
        {id:"N5", t:"Systematic listing & the product rule"},
        {id:"N6", t:"Powers & roots"},
        {id:"N7", t:"Indices (integer & fractional)"},
        {id:"N8", t:"Exact calculations (fractions, π, surds)"},
        {id:"N9", t:"Standard form"}
      ]},
      { id:"3.1.2", title:"Fractions, decimals and percentages", subs:[
        {id:"N10", t:"Fractions ↔ decimals"},
        {id:"N11", t:"Fractions in ratio problems"},
        {id:"N12", t:"Fractions & percentages as operators"}
      ]},
      { id:"3.1.3", title:"Measures and accuracy", subs:[
        {id:"N13", t:"Standard & compound units"},
        {id:"N14", t:"Estimation & checking calculations"},
        {id:"N15", t:"Rounding & error intervals"},
        {id:"N16", t:"Limits of accuracy (bounds)"}
      ]}
    ]},
  algebra: { label:"Algebra", key:"algebra", color:"#5B6FD8", topics:[
      { id:"3.2.1", title:"Notation, vocabulary and manipulation", subs:[
        {id:"A1", t:"Algebraic notation"},
        {id:"A2", t:"Substituting into formulae"},
        {id:"A3", t:"Expressions, equations, identities & inequalities"},
        {id:"A4", t:"Simplifying & factorising expressions"},
        {id:"A5", t:"Standard formulae & rearranging (changing the subject)"},
        {id:"A6", t:"Proof & equivalence of expressions"},
        {id:"A7", t:"Functions, inverse & composite functions"}
      ]},
      { id:"3.2.2", title:"Graphs", subs:[
        {id:"A8", t:"Coordinates in four quadrants"},
        {id:"A9", t:"Straight-line graphs (y = mx + c)"},
        {id:"A10", t:"Gradients & intercepts"},
        {id:"A11", t:"Roots & turning points of quadratics"},
        {id:"A12", t:"Sketching & interpreting graphs"},
        {id:"A13", t:"Translating & reflecting graphs"},
        {id:"A14", t:"Real-life graphs & kinematics graphs"},
        {id:"A15", t:"Gradients & areas under graphs"},
        {id:"A16", t:"Equation of a circle & tangents"}
      ]},
      { id:"3.2.3", title:"Solving equations and inequalities", subs:[
        {id:"A17", t:"Solving linear equations"},
        {id:"A18", t:"Solving quadratic equations"},
        {id:"A19", t:"Simultaneous equations"},
        {id:"A20", t:"Iteration"},
        {id:"A21", t:"Forming & solving equations from context"},
        {id:"A22", t:"Solving & representing inequalities"}
      ]},
      { id:"3.2.4", title:"Sequences", subs:[
        {id:"A23", t:"Generating sequences"},
        {id:"A24", t:"Special sequences (triangular, geometric, Fibonacci)"},
        {id:"A25", t:"nth term of a sequence"}
      ]}
    ]},
  ratio: { label:"Ratio, proportion & rates of change", key:"ratio", color:"#38B6D9", topics:[
      { id:"3.3", title:"Ratio, proportion and rates of change", subs:[
        {id:"R1", t:"Converting units & compound units"},
        {id:"R2", t:"Scale factors, diagrams & maps"},
        {id:"R3", t:"Expressing one quantity as a fraction of another"},
        {id:"R4", t:"Ratio notation"},
        {id:"R5", t:"Dividing quantities in a given ratio"},
        {id:"R6", t:"Multiplicative relationships as ratio/fraction"},
        {id:"R7", t:"Proportion as equality of ratios"},
        {id:"R8", t:"Ratios, fractions & linear functions"},
        {id:"R9", t:"Percentages & percentage change"},
        {id:"R10", t:"Direct & inverse proportion"},
        {id:"R11", t:"Compound units (speed, density, pressure)"},
        {id:"R12", t:"Ratio in lengths, areas & volumes"},
        {id:"R13", t:"Direct/inverse proportion equations"},
        {id:"R14", t:"Gradient as a rate of change"},
        {id:"R15", t:"Rate of change on curves (tangents/chords)"},
        {id:"R16", t:"Growth & decay (compound interest)"}
      ]}
    ]},
  geometry: { label:"Geometry & measures", key:"geometry", color:"#4A6FA5", topics:[
      { id:"3.4.1", title:"Properties and constructions", subs:[
        {id:"G1", t:"Geometric terms & notation"},
        {id:"G2", t:"Ruler & compass constructions, loci"},
        {id:"G3", t:"Angle facts & angle sum of a triangle"},
        {id:"G4", t:"Properties of quadrilaterals & triangles"},
        {id:"G5", t:"Congruence criteria (SSS, SAS, ASA, RHS)"},
        {id:"G6", t:"Angle proofs (incl. Pythagoras)"},
        {id:"G7", t:"Congruent & similar shapes (transformations)"},
        {id:"G8", t:"Combining transformations"},
        {id:"G9", t:"Circle definitions & parts"},
        {id:"G10", t:"Circle theorems"},
        {id:"G11", t:"Geometry on coordinate axes"},
        {id:"G12", t:"Properties of 3D shapes"},
        {id:"G13", t:"Plans & elevations"}
      ]},
      { id:"3.4.2", title:"Mensuration and calculation", subs:[
        {id:"G14", t:"Standard units of measure"},
        {id:"G15", t:"Measuring & bearings"},
        {id:"G16", t:"Area & volume formulae"},
        {id:"G17", t:"Circumference & area of a circle"},
        {id:"G18", t:"Arc length, sector angle & area"},
        {id:"G19", t:"Congruence & similarity (lengths/areas/volumes)"},
        {id:"G20", t:"Pythagoras' theorem & trigonometry (right-angled)"},
        {id:"G21", t:"Exact trig values"},
        {id:"G22", t:"Sine rule & cosine rule"},
        {id:"G23", t:"Area of a triangle (½ab sinC)"}
      ]},
      { id:"3.4.3", title:"Vectors", subs:[
        {id:"G24", t:"Vectors as 2D translations"},
        {id:"G25", t:"Vector arithmetic & geometric proof"}
      ]}
    ]},
  probability: { label:"Probability", key:"probability", color:"#6E8CAE", topics:[
      { id:"3.5", title:"Probability", subs:[
        {id:"P1", t:"Recording & analysing outcomes (tables, frequency trees)"},
        {id:"P2", t:"Randomness, fairness & expected outcomes"},
        {id:"P3", t:"Relative frequency vs theoretical probability"},
        {id:"P4", t:"Probabilities summing to 1"},
        {id:"P5", t:"Sample size & theoretical probability"},
        {id:"P6", t:"Systematic listing (tables, grids, Venn, tree diagrams)"},
        {id:"P7", t:"Possibility spaces & theoretical probability"},
        {id:"P8", t:"Independent & dependent combined events"},
        {id:"P9", t:"Conditional probability"}
      ]}
    ]},
  statistics: { label:"Statistics", key:"statistics", color:"#3D93B8", topics:[
      { id:"3.6", title:"Statistics", subs:[
        {id:"S1", t:"Sampling & inferring about populations"},
        {id:"S2", t:"Tables, charts & diagrams for data"},
        {id:"S3", t:"Histograms & cumulative frequency"},
        {id:"S4", t:"Central tendency & spread (incl. box plots, quartiles)"},
        {id:"S5", t:"Describing a population statistically"},
        {id:"S6", t:"Scatter graphs & correlation"}
      ]}
    ]}
  } },
  englang: { label:"English Language", order:["fiction", "nonfiction", "spoken"], groups:{
  fiction: { label:"Fiction & Imaginative Writing", key:"fiction", color:"#2FA6A6", topics:[
      { id:"EL-F", title:"Component 1", subs:[
        {id:"EL-F1", t:"Reading unseen 19th-century fiction"},
        {id:"EL-F2", t:"Critical reading: themes, evidence & evaluation"},
        {id:"EL-F3", t:"Summarising a single fiction text"},
        {id:"EL-F4", t:"Analysing vocabulary, form & structure (fiction)"},
        {id:"EL-F5", t:"Imaginative writing: narrative & description"},
        {id:"EL-F6", t:"Writing for impact: language & rhetorical devices"}
      ]}
    ]},
  nonfiction: { label:"Non-fiction & Transactional Writing", key:"nonfiction", color:"#5B6FD8", topics:[
      { id:"EL-N", title:"Component 2", subs:[
        {id:"EL-N1", t:"Reading unseen 20th/21st-century non-fiction"},
        {id:"EL-N2", t:"Critical reading: bias, evidence & viewpoint"},
        {id:"EL-N3", t:"Summarising & synthesising across two texts"},
        {id:"EL-N4", t:"Comparing non-fiction texts"},
        {id:"EL-N5", t:"Analysing vocabulary, form & structure (non-fiction)"},
        {id:"EL-N6", t:"Transactional writing: article, letter & review"},
        {id:"EL-N7", t:"Transactional writing: speech & guide/leaflet"}
      ]}
    ]},
  spoken: { label:"Spoken Language Endorsement", key:"spoken", color:"#38B6D9", topics:[
      { id:"EL-S", title:"Separate pass/fail endorsement", subs:[
        {id:"EL-S1", t:"Presenting: structure, register & purpose"},
        {id:"EL-S2", t:"Responding to questions & feedback"},
        {id:"EL-S3", t:"Listening & responding to others' talk"}
      ]}
    ]}
  } },
  englit: { label:"English Literature", order:["macbeth", "inspector", "jekyllhyde", "conflict"], groups:{
  macbeth: { label:"Macbeth (Shakespeare)", key:"macbeth", color:"#2FA6A6", topics:[
      { id:"MAC", title:"Component 1 — Shakespeare", subs:[
        {id:"MAC1", t:"Plot & structure overview"},
        {id:"MAC2", t:"Character: Macbeth"},
        {id:"MAC3", t:"Character: Lady Macbeth"},
        {id:"MAC4", t:"Themes: ambition, power & guilt"},
        {id:"MAC5", t:"Themes: the supernatural & fate"},
        {id:"MAC6", t:"Shakespeare's language & dramatic technique"},
        {id:"MAC7", t:"Context: Jacobean drama & regicide"}
      ]}
    ]},
  inspector: { label:"An Inspector Calls (Priestley)", key:"inspector", color:"#5B6FD8", topics:[
      { id:"AIC", title:"Component 1 — Post-1914 play", subs:[
        {id:"AIC1", t:"Plot & dramatic structure"},
        {id:"AIC2", t:"Character: Inspector Goole"},
        {id:"AIC3", t:"Character: the Birling family"},
        {id:"AIC4", t:"Themes: responsibility & social class"},
        {id:"AIC5", t:"Themes: age, gender & generational conflict"},
        {id:"AIC6", t:"Priestley's dramatic techniques (dramatic irony, structure)"},
        {id:"AIC7", t:"Context: 1912 setting vs 1945 writing"}
      ]}
    ]},
  jekyllhyde: { label:"Dr Jekyll and Mr Hyde (Stevenson)", key:"jekyllhyde", color:"#38B6D9", topics:[
      { id:"JH", title:"Component 2 — 19th-century novel", subs:[
        {id:"JH1", t:"Plot & narrative structure"},
        {id:"JH2", t:"Character: Dr Jekyll & Mr Hyde (duality)"},
        {id:"JH3", t:"Character: Mr Utterson & other narrators"},
        {id:"JH4", t:"Themes: duality of human nature"},
        {id:"JH5", t:"Themes: science, secrecy & reputation"},
        {id:"JH6", t:"Stevenson's use of gothic conventions & structure"},
        {id:"JH7", t:"Context: Victorian society & scientific anxiety"}
      ]}
    ]},
  conflict: { label:"Conflict (Poetry Anthology)", key:"conflict", color:"#4A6FA5", topics:[
      { id:"POEMS", title:"Component 2 — Poetry since 1789", subs:[
        {id:"POEM1", t:"A Poison Tree – Blake"},
        {id:"POEM2", t:"The Destruction of Sennacherib – Byron"},
        {id:"POEM3", t:"Extract from The Prelude 'Boating' – Wordsworth"},
        {id:"POEM4", t:"The Man He Killed – Hardy"},
        {id:"POEM5", t:"Cousin Kate – Rossetti"},
        {id:"POEM6", t:"Exposure – Owen"},
        {id:"POEM7", t:"The Charge of the Light Brigade – Tennyson"},
        {id:"POEM8", t:"Half-caste – Agard"},
        {id:"POEM9", t:"Catrin – Clarke"},
        {id:"POEM10", t:"War Photographer – Satyamurti"},
        {id:"POEM11", t:"Belfast Confetti – Carson"},
        {id:"POEM12", t:"The Class Game – Casey"},
        {id:"POEM13", t:"Poppies – Weir"},
        {id:"POEM14", t:"No Problem – Zephaniah"},
        {id:"POEM15", t:"What Were They Like? – Levertov"}
      ]}
    ]}
  } }
};

function findItem(id) {
  for (const [courseKey, course] of Object.entries(COURSES)) {
    for (const group of Object.values(course.groups)) {
      for (const top of group.topics) {
        for (const s of top.subs) {
          if (s.id === id) {
            return { sub: s, topic: top, subject: group, courseKey, courseLabel: course.label };
          }
        }
      }
    }
  }
  return null;
}

const QUIZ_SCHEMA =
  '{"summary":"...","keyPoints":["..."],"flashcards":[{"q":"...","a":"..."}],"quiz":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}';

function buildPrompt(found) {
  const { sub, topic, subject, courseKey } = found;

  if (courseKey === "science") {
    const isPractical = sub.id.startsWith("RP");
    if (isPractical) {
      return `You are writing AQA GCSE Combined Science: Trilogy (8464) revision material for required practical "${sub.t}" (${sub.id}).
Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this schema:
${QUIZ_SCHEMA}
flashcards must have exactly 5 items focused on apparatus, method steps and variables. quiz must have exactly 5 multiple-choice questions (4 options each) testing method, variables and results interpretation, Foundation-tier appropriate. Keep all text concise and strictly based on the official AQA Combined Science Trilogy specification.`;
    }
    return `You are writing AQA GCSE Combined Science: Trilogy (8464) revision material for specification point ${sub.id} "${sub.t}", part of topic ${topic.id} "${topic.title}" in ${subject.label}.
Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this schema:
${QUIZ_SCHEMA}
flashcards must have exactly 6 items covering key facts, definitions or processes to recall. quiz must have exactly 5 multiple-choice questions (4 options each), mixing recall and application, Foundation-tier appropriate unless a question is explicitly marked (HT). Keep all text concise and strictly within this specification point only.`;
  }

  if (courseKey === "maths") {
    return `You are writing AQA GCSE Mathematics (8300) revision material for specification reference ${sub.id} "${sub.t}", part of ${topic.id} "${topic.title}" in ${subject.label}.
Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this schema:
${QUIZ_SCHEMA}
The summary should explain the method in plain steps a GCSE student can follow, noting clearly if part of it is Higher-tier only. keyPoints should be 4-6 short bullets including any key formula (written in plain text, e.g. "x = (-b \u00b1 \u221a(b\u00b2-4ac)) / 2a"). flashcards must have exactly 6 items testing definitions, formulae or a short worked step. quiz must have exactly 5 questions: prefer numeric-answer style questions (put the correct numeric answer as one of the 4 "options" alongside 3 plausible wrong answers a student might get from a common error, e.g. a sign mistake or a misapplied formula) and give the full worked method in the explanation. Keep everything Foundation-tier appropriate unless explicitly marked (Higher tier).`;
  }

  if (courseKey === "englang") {
    return `You are writing Pearson Edexcel GCSE (9-1) English Language (1EN0) revision material for the skill area "${sub.t}" (part of ${subject.label}).
This is a SKILLS-based specification, not a text-based one \u2014 do not invent or reference any specific named book, since no set text applies here.
Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this schema:
${QUIZ_SCHEMA}
The summary should explain what this skill involves and what examiners reward (tie explicitly to the relevant Assessment Objective where useful, e.g. AO1-AO4). keyPoints should be 4-6 exam-technique bullets (e.g. specific techniques, structural devices, or planning steps). flashcards must have exactly 6 items covering key terminology (e.g. rhetorical devices, structural techniques) with a short definition or example as the answer \u2014 do not quote more than a few words from any real text. quiz must have exactly 5 multiple-choice questions (4 options each) testing recognition or application of the skill, with a one-sentence explanation each.`;
  }

  if (courseKey === "englit") {
    const workNames = {
      macbeth: "Macbeth by William Shakespeare",
      inspector: "An Inspector Calls by J.B. Priestley",
      jekyllhyde: "Dr Jekyll and Mr Hyde by Robert Louis Stevenson",
      conflict: "the poem named in this topic, from the Pearson Poetry Anthology 'Conflict' collection",
    };
    const workName = workNames[subject.key] || subject.label;
    return `You are writing Pearson Edexcel GCSE (9-1) English Literature (1ET0) revision material about "${sub.t}", relating to ${workName}.
Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this schema:
${QUIZ_SCHEMA}
The summary should give a clear, exam-focused explanation of this point (plot/character/theme/technique/context as relevant), written for a GCSE student. keyPoints should be 4-6 exam-focused bullets, and where genuinely useful may include ONE very short textual reference (under 10 words, in quotation marks) per bullet at most \u2014 never quote a full line of poetry or a long passage, paraphrase instead. flashcards must have exactly 6 items testing recall of this specific point \u2014 any quotation used must be under 10 words. quiz must have exactly 5 multiple-choice questions (4 options each) testing understanding of plot, character, theme, technique or context relevant to this point, with a one-sentence explanation each. Keep strictly to what a GCSE student studying this exact text/point needs to know.`;
  }

  // Fallback (should not normally be reached)
  return `Write concise AQA/Edexcel GCSE revision material for "${sub.t}" (${subject.label}).
Return ONLY valid JSON matching exactly this schema:
${QUIZ_SCHEMA}
flashcards: exactly 6 items. quiz: exactly 5 multiple-choice questions (4 options each) with explanations.`;
}

async function handleKV(request, env, key, emptyValue) {
  if (request.method === "GET") {
    const value = await env.PROGRESS_KV.get(key);
    return new Response(value || emptyValue, { headers: { "content-type": "application/json" } });
  }
  if (request.method === "PUT") {
    const body = await request.text();
    try {
      JSON.parse(body);
    } catch (e) {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    await env.PROGRESS_KV.put(key, body);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }
  return new Response("Method not allowed", { status: 405 });
}

async function handleContent(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const force = url.searchParams.get("force") === "1";

  if (!id) {
    return new Response(JSON.stringify({ error: "missing_id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const found = findItem(id);
  if (!found) {
    return new Response(JSON.stringify({ error: "unknown_id" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const cacheKey = `content:${id}`;

  if (!force) {
    const cached = await env.PROGRESS_KV.get(cacheKey);
    if (cached) {
      return new Response(cached, { headers: { "content-type": "application/json" } });
    }
  }

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "missing_api_key" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const prompt = buildPrompt(found);

  const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1400,
      system: `You are a precise ${found.courseLabel} GCSE content writer covering ${found.subject.label}. You always respond with ONLY valid JSON matching the requested schema exactly. No markdown code fences. No commentary before or after the JSON. You never reproduce long passages of copyrighted text \u2014 any quotation is under 10 words.`,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!apiResp.ok) {
    const errText = await apiResp.text();
    return new Response(JSON.stringify({ error: "anthropic_api_error", detail: errText }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const data = await apiResp.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const clean = text.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    return new Response(JSON.stringify({ error: "parse_failed", raw: clean }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  await env.PROGRESS_KV.put(cacheKey, JSON.stringify(parsed));

  return new Response(JSON.stringify(parsed), { headers: { "content-type": "application/json" } });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/progress") return handleKV(request, env, "progress", "{}");
    if (path === "/api/plan") return handleKV(request, env, "study-plan", "null");
    if (path === "/api/activity") return handleKV(request, env, "activity-log", "[]");
    if (path === "/api/content") return handleContent(request, env);

    // Anything else: let the static assets binding serve it (index.html,
    // manifest.json, icon.png, etc). This only runs for paths that didn't
    // already match a static file, per Workers' default routing.
    return env.ASSETS.fetch(request);
  },
};
