// HartFelt Ready™ - Quiz Questions for Portal
// Ported from EASE mobile app CourseQuizzes.js + new Vol 2 quizzes
// Keys: 'vol{volume}_m{module}' e.g. 'vol1_m1', 'vol2_m8'

export interface QuizOption {
  id: string
  text: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: QuizOption[]
  correct: string
}

export interface Quiz {
  title: string
  passingScore: number
  questions: QuizQuestion[]
}

export const MODULE_QUIZZES: Record<string, Quiz> = {
  // ═══════════════════════════════════════════
  // VOLUME 1 — Foundations (Modules 1-9)
  // 1=Foundations, 2=Lead Mastery, 3=Listing Systems,
  // 4=Buyer Experience, 5=Showing Playbook (NEW),
  // 6=Transaction to Close, 7=Marketing & Branding,
  // 8=Growth & Retention, 9=AI for Real Estate
  // ═══════════════════════════════════════════

  vol1_m1: {
    title: 'Foundations Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v1m1q1',
        question: 'What does "luxury" mean at HartFelt?',
        options: [
          { id: 'a', text: 'High price point' },
          { id: 'b', text: 'Premium marketing materials' },
          { id: 'c', text: 'Professional behavior, precision, and execution' },
          { id: 'd', text: 'Large square footage' },
        ],
        correct: 'c',
      },
      {
        id: 'v1m1q2',
        question: 'What is the HartFelt response standard for clients?',
        options: [
          { id: 'a', text: 'Within 72 hours' },
          { id: 'b', text: 'Same day or within 24 hours' },
          { id: 'c', text: 'Only during business hours' },
          { id: 'd', text: 'When convenient' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m1q3',
        question: 'True or False: Presentation is more important than process at HartFelt.',
        options: [
          { id: 'a', text: 'True' },
          { id: 'b', text: 'False' },
        ],
        correct: 'a',
      },
    ],
  },

  vol1_m2: {
    title: 'Lead Mastery Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v1m2q1',
        question: 'How fast should inbound leads be contacted?',
        options: [
          { id: 'a', text: 'Within 1 hour' },
          { id: 'b', text: 'Same day' },
          { id: 'c', text: 'Within 5 minutes' },
          { id: 'd', text: 'Next business day' },
        ],
        correct: 'c',
      },
      {
        id: 'v1m2q2',
        question: 'What are the HartFelt lead pipeline categories?',
        options: [
          { id: 'a', text: 'Buyer, Seller, Investor, Builder' },
          { id: 'b', text: 'Hot, Warm, Nurture, Cold' },
          { id: 'c', text: 'Paid, Organic, Referral, Walk-in' },
          { id: 'd', text: 'Active, Pending, Closed, Lost' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m2q3',
        question: 'How often should "Warm" leads be followed up?',
        options: [
          { id: 'a', text: 'Daily' },
          { id: 'b', text: 'Weekly' },
          { id: 'c', text: 'Monthly' },
          { id: 'd', text: 'Quarterly' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m2q4',
        question: 'What is the biggest pipeline killer?',
        options: [
          { id: 'a', text: 'Price objections' },
          { id: 'b', text: 'Marketing spend' },
          { id: 'c', text: 'Inconsistent follow-up' },
          { id: 'd', text: 'Competition' },
        ],
        correct: 'c',
      },
    ],
  },

  vol1_m3: {
    title: 'Listing Systems Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v1m3q1',
        question: 'What is your responsibility if a seller insists on listing above market value?',
        options: [
          { id: 'a', text: 'Agree to keep the client happy' },
          { id: 'b', text: 'Let the market decide' },
          { id: 'c', text: 'Present data and align expectations' },
          { id: 'd', text: 'Ignore the objection' },
        ],
        correct: 'c',
      },
      {
        id: 'v1m3q2',
        question: 'How many comps are required in the HartFelt pricing framework?',
        options: [
          { id: 'a', text: '3 total' },
          { id: 'b', text: '6 total' },
          { id: 'c', text: '9 total (3 active, 3 pending, 3 sold)' },
          { id: 'd', text: 'Unlimited' },
        ],
        correct: 'c',
      },
      {
        id: 'v1m3q3',
        question: 'When is buyer urgency strongest after a listing launches?',
        options: [
          { id: 'a', text: 'First 90 days' },
          { id: 'b', text: 'First 30 days' },
          { id: 'c', text: 'First 14 days' },
          { id: 'd', text: 'After a price reduction' },
        ],
        correct: 'c',
      },
      {
        id: 'v1m3q4',
        question: 'What is mandatory in the HartFelt marketing plan?',
        options: [
          { id: 'a', text: 'Flyers' },
          { id: 'b', text: 'Social media posts' },
          { id: 'c', text: 'Professional photography' },
          { id: 'd', text: 'Open house' },
        ],
        correct: 'c',
      },
    ],
  },

  vol1_m4: {
    title: 'Buyer Experience Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v1m4q1',
        question: 'What must be verified before scheduling showings?',
        options: [
          { id: 'a', text: 'Favorite neighborhoods' },
          { id: 'b', text: 'Pre-approval or proof of funds' },
          { id: 'c', text: 'Social media presence' },
          { id: 'd', text: 'Credit score only' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m4q2',
        question: 'What is the primary goal of the Buyer Consultation?',
        options: [
          { id: 'a', text: 'Show houses' },
          { id: 'b', text: 'Build trust and align expectations' },
          { id: 'c', text: 'Collect a retainer' },
          { id: 'd', text: 'Push urgency' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m4q3',
        question: 'How should buyers be guided during showings?',
        options: [
          { id: 'a', text: 'Oversell features' },
          { id: 'b', text: 'Stay silent' },
          { id: 'c', text: 'Calm, neutral, data-based framing' },
          { id: 'd', text: 'Pressure offers' },
        ],
        correct: 'c',
      },
    ],
  },

  // NEW Module 5 — Showing Playbook (inserted after Buyer Experience)
  vol1_m5: {
    title: 'HartFelt Showing Playbook Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v1m5q1',
        question: 'What does HART stand for in the HART Method?',
        options: [
          { id: 'a', text: 'Help, Assist, Refer, Track' },
          { id: 'b', text: 'Hear, Activate, Read & Respond, Transition' },
          { id: 'c', text: 'Host, Arrange, Review, Transfer' },
          { id: 'd', text: 'Handle, Approach, Redirect, Trust' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m5q2',
        question: 'What is the first question you should ask when a client enters a property?',
        options: [
          { id: 'a', text: '"Do you like the kitchen?"' },
          { id: 'b', text: '"Ready to make an offer?"' },
          { id: 'c', text: '"What is your first impression?"' },
          { id: 'd', text: '"How many bedrooms do you need?"' },
        ],
        correct: 'c',
      },
      {
        id: 'v1m5q3',
        question: 'What must you know after EVERY showing according to the Deal Control Rule?',
        options: [
          { id: 'a', text: 'The listing price, HOA fees, and square footage' },
          { id: 'b', text: 'Their rating, their objection, and their next step' },
          { id: 'c', text: 'Their credit score, timeline, and budget' },
          { id: 'd', text: 'The seller motivation, listing history, and comps' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m5q4',
        question: 'What is the HartFelt Safety Protocol rule if something feels off during a showing?',
        options: [
          { id: 'a', text: 'Stay and finish the showing professionally' },
          { id: 'b', text: 'Call your broker immediately' },
          { id: 'c', text: 'You leave — no hesitation' },
          { id: 'd', text: 'Ask the client to leave first' },
        ],
        correct: 'c',
      },
    ],
  },

  // Module 6 — Transaction to Close (was Module 5)
  vol1_m6: {
    title: 'Transaction Management Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v1m6q1',
        question: 'When should contract dates be entered into the system?',
        options: [
          { id: 'a', text: 'After inspection' },
          { id: 'b', text: 'After closing' },
          { id: 'c', text: 'Immediately after acceptance' },
          { id: 'd', text: 'Only if lender asks' },
        ],
        correct: 'c',
      },
      {
        id: 'v1m6q2',
        question: 'What happens when one milestone slips?',
        options: [
          { id: 'a', text: 'Nothing' },
          { id: 'b', text: 'The closing timeline collapses' },
          { id: 'c', text: 'Title fixes it' },
          { id: 'd', text: 'The lender delays automatically' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m6q3',
        question: 'Inspection focus should be on:',
        options: [
          { id: 'a', text: 'Cosmetic items' },
          { id: 'b', text: 'Buyer emotions' },
          { id: 'c', text: 'Safety, structure, and systems' },
          { id: 'd', text: 'Negotiation tactics' },
        ],
        correct: 'c',
      },
    ],
  },

  // Module 7 — Marketing & Branding (was Module 6)
  vol1_m7: {
    title: 'Marketing & Branding Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v1m7q1',
        question: 'What are the three pillars of HartFelt branding?',
        options: [
          { id: 'a', text: 'Leads, Listings, Luxury' },
          { id: 'b', text: 'Authority, Authenticity, Aesthetic' },
          { id: 'c', text: 'Growth, Sales, Referrals' },
          { id: 'd', text: 'Content, Reels, Email' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m7q2',
        question: 'What is the HartFelt brand voice?',
        options: [
          { id: 'a', text: 'Casual and trendy' },
          { id: 'b', text: 'Aggressive and salesy' },
          { id: 'c', text: 'Confident, warm, precise' },
          { id: 'd', text: 'Humorous and viral' },
        ],
        correct: 'c',
      },
      {
        id: 'v1m7q3',
        question: 'What is the purpose of lifestyle content?',
        options: [
          { id: 'a', text: 'Show off' },
          { id: 'b', text: 'Dilute brand' },
          { id: 'c', text: 'Humanize the brand and build trust' },
          { id: 'd', text: 'Avoid real estate topics' },
        ],
        correct: 'c',
      },
    ],
  },

  // Module 8 — Growth & Retention (was Module 7)
  vol1_m8: {
    title: 'Growth & Retention Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v1m8q1',
        question: "What is HartFelt's philosophy on growth?",
        options: [
          { id: 'a', text: 'Luck' },
          { id: 'b', text: 'Paid leads' },
          { id: 'c', text: 'Systems, habits, and accountability' },
          { id: 'd', text: 'Viral marketing' },
        ],
        correct: 'c',
      },
      {
        id: 'v1m8q2',
        question: 'What should agents track weekly?',
        options: [
          { id: 'a', text: 'Social likes' },
          { id: 'b', text: 'KPIs (leads, appointments, contracts, closings)' },
          { id: 'c', text: 'Competitor listings' },
          { id: 'd', text: 'Market gossip' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m8q3',
        question: 'What is the HartFelt growth formula?',
        options: [
          { id: 'a', text: 'Leads -> Ads -> Closings' },
          { id: 'b', text: 'Conversations -> Listings -> Luxury' },
          { id: 'c', text: 'Leads -> Conversations -> Appointments -> Contracts -> Closings' },
          { id: 'd', text: 'Marketing -> Branding -> Referrals' },
        ],
        correct: 'c',
      },
    ],
  },

  // Module 9 — AI for Real Estate (was Module 8, shifted for Showing Playbook)
  vol1_m9: {
    title: 'AI for Real Estate Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v1m9q1',
        question: 'What is the primary purpose of AI for real estate agents?',
        options: [
          { id: 'a', text: 'Replace agents entirely' },
          { id: 'b', text: 'Multiply your capabilities' },
          { id: 'c', text: 'Automate all communication' },
          { id: 'd', text: 'Generate leads only' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m9q2',
        question: 'What should you always do before sending AI-generated content to a client?',
        options: [
          { id: 'a', text: 'Add more adjectives' },
          { id: 'b', text: 'Review and personalize it' },
          { id: 'c', text: 'Send it immediately' },
          { id: 'd', text: 'Forward it to your broker' },
        ],
        correct: 'b',
      },
      {
        id: 'v1m9q3',
        question: 'Which is a recommended use of AI in real estate?',
        options: [
          { id: 'a', text: 'Replacing client meetings' },
          { id: 'b', text: 'Writing listing descriptions and market analyses' },
          { id: 'c', text: 'Making pricing decisions without data' },
          { id: 'd', text: 'Automating contract signatures' },
        ],
        correct: 'b',
      },
    ],
  },

  // ═══════════════════════════════════════════
  // VOLUME 3 / AI Training (also mapped as vol3_m1 for legacy)
  // ═══════════════════════════════════════════

  vol3_m1: {
    title: 'AI for Real Estate Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v3m1q1',
        question: 'What is the primary purpose of AI for real estate agents?',
        options: [
          { id: 'a', text: 'Replace agents entirely' },
          { id: 'b', text: 'Multiply your capabilities' },
          { id: 'c', text: 'Automate all communication' },
          { id: 'd', text: 'Generate leads only' },
        ],
        correct: 'b',
      },
      {
        id: 'v3m1q2',
        question: 'When should you use ChatGPT vs Claude?',
        options: [
          { id: 'a', text: 'ChatGPT for everything' },
          { id: 'b', text: 'ChatGPT for speed, Claude for depth' },
          { id: 'c', text: 'Claude for everything' },
          { id: 'd', text: 'Neither — use Google' },
        ],
        correct: 'b',
      },
      {
        id: 'v3m1q3',
        question: 'What is the 4-part prompting formula?',
        options: [
          { id: 'a', text: 'Who, What, When, Where' },
          { id: 'b', text: 'Role, Task, Context, Tone' },
          { id: 'c', text: 'Input, Process, Output, Review' },
          { id: 'd', text: 'Ask, Wait, Copy, Paste' },
        ],
        correct: 'b',
      },
      {
        id: 'v3m1q4',
        question: 'What should you AVOID doing with AI?',
        options: [
          { id: 'a', text: 'Writing listing descriptions' },
          { id: 'b', text: 'Practicing objection handling' },
          { id: 'c', text: 'Copying and pasting without editing' },
          { id: 'd', text: 'Generating follow-up texts' },
        ],
        correct: 'c',
      },
      {
        id: 'v3m1q5',
        question: 'How does AI help agents make more money?',
        options: [
          { id: 'a', text: 'By replacing client meetings' },
          { id: 'b', text: 'By responding faster, marketing better, and communicating clearly' },
          { id: 'c', text: 'By automating all negotiations' },
          { id: 'd', text: 'By generating fake reviews' },
        ],
        correct: 'b',
      },
    ],
  },

  // ═══════════════════════════════════════════
  // VOLUME 2 — Elite (Modules 8-14)
  // 8=Investor Strategy, 9=Deal Structuring,
  // 10=Development & Zoning, 11=Luxury Psychology,
  // 12=Capital Conversations, 13=Risk & Reputation,
  // 14=Client Acquisition (NEW)
  // ═══════════════════════════════════════════

  vol2_m8: {
    title: 'Investor & Off-Market Strategy Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v2m8q1',
        question: 'What do investors buy?',
        options: [
          { id: 'a', text: 'Homes they love' },
          { id: 'b', text: 'Certainty, not homes' },
          { id: 'c', text: 'The cheapest properties' },
          { id: 'd', text: 'Whatever their agent recommends' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m8q2',
        question: 'How should you communicate deals to investors?',
        options: [
          { id: 'a', text: 'With hype and excitement' },
          { id: 'b', text: 'With personal opinions presented as analysis' },
          { id: 'c', text: 'Through data, not emotion' },
          { id: 'd', text: 'By promising specific returns' },
        ],
        correct: 'c',
      },
      {
        id: 'v2m8q3',
        question: 'What does "off-market" represent in investor strategy?',
        options: [
          { id: 'a', text: 'Properties that failed on the MLS' },
          { id: 'b', text: 'Asymmetric access and competitive advantage' },
          { id: 'c', text: 'Illegal deals' },
          { id: 'd', text: 'Discount properties only' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m8q4',
        question: 'Which of the following should an agent NEVER do when working with investors?',
        options: [
          { id: 'a', text: 'Present comparable data' },
          { id: 'b', text: 'Explain exit optionality' },
          { id: 'c', text: 'Give investment advice or promise returns' },
          { id: 'd', text: 'Discuss downside protection' },
        ],
        correct: 'c',
      },
    ],
  },

  vol2_m9: {
    title: 'Assignments, Structuring & Deal Control Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v2m9q1',
        question: 'What does "leverage" mean in deal structuring at HartFelt?',
        options: [
          { id: 'a', text: 'Using force to close deals' },
          { id: 'b', text: 'Structure, not force' },
          { id: 'c', text: 'Borrowing money' },
          { id: 'd', text: 'Having more listings than competitors' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m9q2',
        question: 'Why should title be opened immediately on every deal?',
        options: [
          { id: 'a', text: 'To impress the seller' },
          { id: 'b', text: 'Because title control equals deal control' },
          { id: 'c', text: 'It is a legal requirement in all states' },
          { id: 'd', text: 'To speed up marketing' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m9q3',
        question: 'When should you walk away from a deal?',
        options: [
          { id: 'a', text: 'When the commission is below 3%' },
          { id: 'b', text: 'When structure is forced, parties bypass agreements, or risk outweighs return' },
          { id: 'c', text: 'Never — always close' },
          { id: 'd', text: 'Only when the broker says so' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m9q4',
        question: 'What is proper assignment etiquette?',
        options: [
          { id: 'a', text: 'Explain all fee details to every party' },
          { id: 'b', text: 'Never over-explain, never disclose amounts, never surprise title' },
          { id: 'c', text: 'Only work with cash buyers' },
          { id: 'd', text: 'Always use double closes instead' },
        ],
        correct: 'b',
      },
    ],
  },

  vol2_m10: {
    title: 'Development, Zoning & Land Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v2m10q1',
        question: 'What does zoning control?',
        options: [
          { id: 'a', text: 'Property taxes' },
          { id: 'b', text: 'What CAN be built on a parcel' },
          { id: 'c', text: 'Who can buy the property' },
          { id: 'd', text: 'Construction costs' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m10q2',
        question: 'What is often the "deal killer" in development projects?',
        options: [
          { id: 'a', text: 'Exterior paint color' },
          { id: 'b', text: 'Landscaping requirements' },
          { id: 'c', text: 'Parking requirements' },
          { id: 'd', text: 'School district boundaries' },
        ],
        correct: 'c',
      },
      {
        id: 'v2m10q3',
        question: 'What is the agent\'s role in development deals?',
        options: [
          { id: 'a', text: 'Act as the technical expert on zoning' },
          { id: 'b', text: 'Strategic advisor who brings in professionals — don\'t overstep' },
          { id: 'c', text: 'Make engineering recommendations' },
          { id: 'd', text: 'Guarantee entitlement approval' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m10q4',
        question: 'Developers think in risk layers. Which is NOT one of those layers?',
        options: [
          { id: 'a', text: 'Entitlement risk' },
          { id: 'b', text: 'Social media risk' },
          { id: 'c', text: 'Construction risk' },
          { id: 'd', text: 'Capital risk' },
        ],
        correct: 'b',
      },
    ],
  },

  vol2_m11: {
    title: 'Luxury Client Psychology & Discretion Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v2m11q1',
        question: 'What do luxury clients value most?',
        options: [
          { id: 'a', text: 'Excitement and attention' },
          { id: 'b', text: 'Time over money, certainty over excitement, privacy over exposure' },
          { id: 'c', text: 'The biggest marketing campaign possible' },
          { id: 'd', text: 'Frequent daily check-ins' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m11q2',
        question: 'How should authority be communicated with luxury clients?',
        options: [
          { id: 'a', text: 'Bold claims and flashy presentations' },
          { id: 'b', text: 'Calm pace, neutral tone, fewer adjectives' },
          { id: 'c', text: 'Name-dropping other high-profile clients' },
          { id: 'd', text: 'Sharing deal numbers publicly for credibility' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m11q3',
        question: 'Which privacy rule is part of the HartFelt Private Client Code of Conduct?',
        options: [
          { id: 'a', text: 'Post all closings on social media' },
          { id: 'b', text: 'Share transaction details with other agents for referrals' },
          { id: 'c', text: 'No posting without consent, no name-dropping, no sharing numbers' },
          { id: 'd', text: 'Only share details after 30 days' },
        ],
        correct: 'c',
      },
    ],
  },

  vol2_m12: {
    title: 'Capital Conversations & Investor Confidence Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v2m12q1',
        question: 'What does capital move toward?',
        options: [
          { id: 'a', text: 'Confidence and charisma' },
          { id: 'b', text: 'Clarity, not confidence' },
          { id: 'c', text: 'The highest returns' },
          { id: 'd', text: 'Aggressive pitches' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m12q2',
        question: 'Which is an example of safe language when discussing investments?',
        options: [
          { id: 'a', text: '"This property will appreciate 15% per year"' },
          { id: 'b', text: '"I recommend investing here for guaranteed returns"' },
          { id: 'c', text: '"Historically, similar assets have traded in this range"' },
          { id: 'd', text: '"You\'ll definitely double your money"' },
        ],
        correct: 'c',
      },
      {
        id: 'v2m12q3',
        question: 'How do you build investor confidence?',
        options: [
          { id: 'a', text: 'Through persuasion and salesmanship' },
          { id: 'b', text: 'Through preparation, not persuasion' },
          { id: 'c', text: 'By guaranteeing outcomes' },
          { id: 'd', text: 'By minimizing all risks in your presentation' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m12q4',
        question: 'What is the difference between information and advice?',
        options: [
          { id: 'a', text: 'There is no difference' },
          { id: 'b', text: 'Information is sharing data; advice is recommending investments or promising returns' },
          { id: 'c', text: 'Information is verbal; advice is written' },
          { id: 'd', text: 'Advice is always legal; information is not' },
        ],
        correct: 'b',
      },
    ],
  },

  vol2_m13: {
    title: 'Risk, Reputation & Long-Game Thinking Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v2m13q1',
        question: 'What compounds over time in real estate?',
        options: [
          { id: 'a', text: 'Commissions' },
          { id: 'b', text: 'Marketing spend' },
          { id: 'c', text: 'Reputation' },
          { id: 'd', text: 'Social media followers' },
        ],
        correct: 'c',
      },
      {
        id: 'v2m13q2',
        question: 'What is the real enemy according to Module 13?',
        options: [
          { id: 'a', text: 'Risk itself' },
          { id: 'b', text: 'Competition' },
          { id: 'c', text: 'Surprise — not risk' },
          { id: 'd', text: 'Low commission rates' },
        ],
        correct: 'c',
      },
      {
        id: 'v2m13q3',
        question: 'When should you walk away from a deal?',
        options: [
          { id: 'a', text: 'When the deal requires misrepresentation' },
          { id: 'b', text: 'When the commission is less than expected' },
          { id: 'c', text: 'When the client is difficult' },
          { id: 'd', text: 'Never — always find a way to close' },
        ],
        correct: 'a',
      },
      {
        id: 'v2m13q4',
        question: 'What is the HartFelt ethics test?',
        options: [
          { id: 'a', text: 'Ask your broker first' },
          { id: 'b', text: 'If you wouldn\'t put it in writing, don\'t say it' },
          { id: 'c', text: 'Check if it is technically legal' },
          { id: 'd', text: 'See if competitors are doing it' },
        ],
        correct: 'b',
      },
    ],
  },

  // Module 14 — Client Acquisition: Access Over Leads (NEW)
  vol2_m14: {
    title: 'Client Acquisition Quiz',
    passingScore: 80,
    questions: [
      {
        id: 'v2m14q1',
        question: 'What is the HartFelt Law from the Client Acquisition module?',
        options: [
          { id: 'a', text: 'More leads equals more closings' },
          { id: 'b', text: 'Proximity creates power, power creates opportunity, opportunity creates income' },
          { id: 'c', text: 'Social media is the key to growth' },
          { id: 'd', text: 'Cold calling builds the strongest pipeline' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m14q2',
        question: 'Which is NOT one of the 5 Access Levers?',
        options: [
          { id: 'a', text: 'Inventory Access' },
          { id: 'b', text: 'Proximity to Power' },
          { id: 'c', text: 'Social Media Followers' },
          { id: 'd', text: 'Consistency in the Room' },
        ],
        correct: 'c',
      },
      {
        id: 'v2m14q3',
        question: 'What does ACCESS stand for in the HartFelt system?',
        options: [
          { id: 'a', text: 'Attract, Close, Convert, Earn, Sell, Scale' },
          { id: 'b', text: 'Attach, Contribute, Commit, Educate, Stay Visible, Scale' },
          { id: 'c', text: 'Advertise, Call, Connect, Engage, Sell, Succeed' },
          { id: 'd', text: 'Approach, Create, Communicate, Execute, Support, Sustain' },
        ],
        correct: 'b',
      },
      {
        id: 'v2m14q4',
        question: 'What is the goal for moving through Access Levels?',
        options: [
          { id: 'a', text: 'Jump to Authority in one week' },
          { id: 'b', text: 'Move up one level every 30-60 days' },
          { id: 'c', text: 'Stay at Observer until you close 10 deals' },
          { id: 'd', text: 'Skip levels based on experience' },
        ],
        correct: 'b',
      },
    ],
  },
}

/**
 * Look up a quiz by volume and module number.
 * Volume 1: modules 1-8, Volume 2: modules 8-14, Volume 3 (AI): modules 1-8
 */
export function getQuizForModule(volume: number, moduleNum: number): Quiz | null {
  return MODULE_QUIZZES[`vol${volume}_m${moduleNum}`] || null
}

/**
 * Grade a set of answers against a quiz.
 * Returns { score, passed, correctCount, totalQuestions, correctAnswers }
 */
export function gradeQuiz(
  quiz: Quiz,
  answers: Record<string, string>
): {
  score: number
  passed: boolean
  correctCount: number
  totalQuestions: number
  correctAnswers: Record<string, string>
} {
  const totalQuestions = quiz.questions.length
  let correctCount = 0
  const correctAnswers: Record<string, string> = {}

  for (const q of quiz.questions) {
    correctAnswers[q.id] = q.correct
    if (answers[q.id] === q.correct) {
      correctCount++
    }
  }

  const score = Math.round((correctCount / totalQuestions) * 100)
  return {
    score,
    passed: score >= quiz.passingScore,
    correctCount,
    totalQuestions,
    correctAnswers,
  }
}
