'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { BookOpen, Play, Clock, CheckCircle, Lock, Unlock, Award, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase as sharedSupabase } from '../../lib/supabase'

type Volume = 'volume-1' | 'volume-2' | 'volume-3'
type Screen = 'volumes' | 'volume-select' | 'modules' | 'module-content' | 'module-test' | 'test-results' | 'final-exam' | 'final-results' | 'certificate'

interface TrainingProgress {
  user_id: string
  volume: Volume
  module: number
  completed_modules: number[]
  test_scores: { [key: string]: number }
  volume_completed: boolean
  final_exam_score?: number
  certification_date?: string
}

interface TestQuestion {
  id: string
  question: string
  options: string[]
  correct_answer: number
}

interface Module {
  id: number
  title: string
  content: string
  questions: TestQuestion[]
}

interface VolumeData {
  id: Volume
  title: string
  description: string
  modules: Module[]
  finalExam: TestQuestion[]
  locked: boolean
  password?: string
}

export default function TrainingInteractivePage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  // UI States
  const [screen, setScreen] = useState<Screen>('volumes')
  const [currentVolume, setCurrentVolume] = useState<Volume | null>(null)
  const [currentModule, setCurrentModule] = useState(0)
  const [passwordInput, setPasswordInput] = useState('')
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [contentScrollPos, setContentScrollPos] = useState(0)

  // Training State
  const [progress, setProgress] = useState<TrainingProgress | null>(null)
  const [testAnswers, setTestAnswers] = useState<{ [key: string]: number }>({})
  const [testScore, setTestScore] = useState(0)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [certificateData, setCertificateData] = useState<{ name: string; score: number; date: string } | null>(null)
  const [supabase, setSupabase] = useState<any>(null)

  // Video state for module content
  const [moduleVideos, setModuleVideos] = useState<any[]>([])
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0)
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [allVideosWatched, setAllVideosWatched] = useState(false)

  // Module content for Volume 1
  const volumeData: { [key in Volume]: VolumeData } = {
    'volume-1': {
      id: 'volume-1',
      title: 'HartFelt Ready™ Volume 1',
      description: 'The Standard Before the Strategy',
      locked: false,
      modules: [
        {
          id: 1,
          title: 'Module 1: Foundations',
          content: `THE HARTFELT STANDARD

"Train Smart. Close Confident. Live Local Luxury."

Welcome to HartFelt Ready
At HartFelt, we operate with one rule: Excellence is the expectation.
Whether you're closing a deal in Newark, walking a lot in Nutley, or showing luxury in Las Olas, your process must be consistent, strategic, and rooted in service.

OUR CORE VALUES
• Professionalism: Every client deserves luxury-level service — regardless of price point.
• Preparation: Market knowledge is your leverage.
• Integrity: Every word, every email, every action builds or breaks trust.
• Discipline: Your daily habits determine your long-term volume.
• Heart: Empathy drives results.

THE HARTFELT BRAND PHILOSOPHY
"Luxury isn't about the price tag - it's about the experience."

At HartFelt, luxury is behavior, not budget. We build credibility through systems, communication, and presentation - not hype. Our brand is rooted in local expertise, authenticity, and elevated professionalism.

WHAT SETS YOU APART
• You study zoning maps, not just hashtags.
• You know the story behind every property you market.
• You price based on fact, not emotion.
• You follow through - even when no one's watching.

Your brand promise: Every conversation, email, showing, and closing should feel intentional, informed, and HartFelt.

PROFESSIONAL COMMUNICATION STANDARDS

Email Standards:
• Respond within 24 hours (or same business day when possible).
• Never send contracts, offers, or sensitive data without confirming receipt.
• Subject lines must be clear and professional.
• Signatures must include your full contact information.

Texting Standards:
• Keep all communication professional and documented.
• Always confirm next steps in writing.
• Avoid casual tone with clients or cooperating agents - clarity is your leverage.
• Use text for confirmations, not negotiations.

Call Standards:
• Take notes immediately after each client call.
• Confirm verbal agreements by email or text.
• Remember: tone communicates confidence - be calm, factual, and decisive.
• Return calls within business hours same day.

MARKET KNOWLEDGE & MLS FAMILIARITY
You can't sell what you don't understand.

Every new agent must master:
• Local zoning basics (R1, R2, C1, etc.)
• Tax record searches
• Flood zone and lot dimension reading
• MLS shortcuts: pulling comps, viewing agent notes, and exporting listings

ZILLOW COMPS TRAINING

Step-by-Step Overview:
1. Start with the Property - Search by address on Zillow.com. Confirm bedrooms, bathrooms, square footage, lot size, and neighborhood.

2. Access Nearby Sales - Scroll to "Nearby Similar Homes" or select "Buy > More > Sold."

3. Apply Proper Filters:
   • Status: Sold
   • Time: Last 6 months
   • Type: Match the subject property
   • Beds/Baths: Within ±1
   • SqFt: Within ±20%
   • Lot: Similar size
   • Distance: Within 0.5–1 mile

4. Review Each Comp - Compare sale price, price per sqft, days on market, and condition. Avoid main roads or heavily renovated properties.

5. Calculate Market Value - Average the $/SqFt of 3-5 solid comps. Multiply by subject property's sqft to estimate fair market value.

6. Document Your Results - Create a spreadsheet or PDF summary with the 3-5 best comps and notes.

WHY AVOID HEAVILY RENOVATED PROPERTIES
• Renovations inflate value - remodeled homes command higher premiums.
• Appraisers won't use them - condition adjustments skew accuracy.
• Buyers shop by visuals - an outdated home won't compete with new kitchens.
• Creates unrealistic expectations - sellers overprice when they see luxury comps.

What to Do:
• Match condition to condition (dated to dated, renovated to renovated).
• Adjust only for small differences, not full remodels.
• Use active or pending sales for real-time pricing context.

"Your comp isn't about potential - it's about proof."

HARTFELT DAILY WORKFLOW

Morning:
• 8:00 AM - Market check: new listings, price drops, and pendings.
• 9:00 AM - Follow-up hour: new leads, messages, and open contracts.

Afternoon:
• 12:00 PM - Prospecting hour (calls, texts, emails).
• 2:00 PM - Client appointments and showings.

Evening:
• 6:00 PM - Document day's progress.
• 6:30 PM - Review active deals + prepare next day's schedule.

Goal: Each day should move at least one client or deal closer to the closing table.`,
          questions: [
            {
              id: 'q1-1',
              question: 'What does "luxury" mean at HartFelt?',
              options: ['High price point', 'Premium marketing materials', 'Professional behavior, precision, and execution', 'Large square footage'],
              correct_answer: 2
            },
            {
              id: 'q1-2',
              question: 'What is the HartFelt response standard for clients?',
              options: ['Within 72 hours', 'Same day or within 24 hours', 'Only during business hours', 'When convenient'],
              correct_answer: 1
            },
            {
              id: 'q1-3',
              question: 'When running comps, what is the minimum number of comparable properties?',
              options: ['1–2', '3–5', '10+', 'Any number is acceptable'],
              correct_answer: 1
            },
            {
              id: 'q1-4',
              question: 'Why should fully renovated properties usually NOT be primary comps?',
              options: ['They are too expensive', 'They inflate perceived value and distort pricing accuracy', 'MLS hides them', 'Buyers do not consider them'],
              correct_answer: 1
            },
            {
              id: 'q1-5',
              question: 'What is the purpose of the HartFelt daily workflow?',
              options: ['Stay busy', 'Post content', 'Move at least one client closer to contract or closing', 'Generate followers'],
              correct_answer: 2
            }
          ]
        },
        {
          id: 2,
          title: 'Module 2: Lead Mastery',
          content: `LEAD MASTERY

"You don't chase business - you build gravity."

THE HARTFELT LEAD PHILOSOPHY
Leads are the lifeblood of your business - but not all leads are equal. We don't buy names. We build relationships. The difference between a good agent and a top producer isn't luck - it's consistent, structured follow-up and an understanding of human timing.

At HartFelt, we believe:
• A lead is a future relationship, not a phone number.
• The agent who follows up last usually wins.
• Every touch point must add value, not pressure.

Goal: To create a pipeline where your daily actions feed your future income.

UNDERSTANDING LEAD SOURCES

Primary Lead Channels:
• Sphere of Influence (SOI) - Friends, family, past clients, referrals. Your foundation - nurture consistently.
• Zillow/Realtor.com Leads - Online inquiries & property requests. Fast response = higher conversion.
• Social Media Leads - Instagram, Facebook, YouTube, LinkedIn. Relationship-driven, build trust through value.
• Open Houses - Walk-ins, neighbors, investors. The best live lead lab.
• Cold Outreach - Expireds, FSBOs, absentee owners. Respectful persistence builds credibility.
• Referral Partners - Lenders, attorneys, contractors. Collaborate & exchange leads long-term.

LEAD CLASSIFICATION SYSTEM
To stay organized, every HartFelt agent must label every lead using our 4-tier pipeline system:

Hot: Ready to buy/sell within 30 days → Daily contact
Warm: 1–3 months timeline → Weekly follow-up
Nurture: 3–6 months timeline → Monthly check-in
Cold: 6+ months or low intent → Quarterly touch point

Rule: Never delete a lead. Circumstances change. A "cold" contact today can be your hottest deal next spring.

CRM WORKFLOW: "HARTFELT LEAD TRACKER"
Every agent must log all contacts into the CRM or the HartFelt Lead Tracker (Google Sheet).

Key Columns:
• Name
• Source
• Contact Info
• Type (Buyer/Seller/Investor)
• Last Contact Date
• Follow-Up Frequency
• Notes / Motivation Level

Color Coding:
• Red = Hot
• Orange = Warm
• Yellow = Nurture
• Green = Cold

SCRIPTS & DIALOGUE FRAMEWORKS

First Call Script:
"Hey [Name], this is [Agent] with HartFelt Real Estate. I saw you were interested in [property/address]. Tell me a little bit about what's caught your eye - are you looking for something similar or just exploring right now?"

Listen first. Don't pitch. Qualify.

7-DAY CONVERSION CHALLENGE
The goal: 1 appointment per ~20 real conversations.

Not calls. Conversations.
Not pitches. Questions.

Day 1-2: List all leads from the past week
Day 3-4: Have 20 real conversations (texts, calls, messages)
Day 5-6: Set at least 1 appointment
Day 7: Close the appointment with a qualified buyer or seller

Track everything. What works gets repeated.`,
          questions: [
            {
              id: 'q2-1',
              question: 'How fast should inbound leads be contacted?',
              options: ['Within 1 hour', 'Same day', 'Within 5 minutes', 'Next business day'],
              correct_answer: 2
            },
            {
              id: 'q2-2',
              question: 'What are the HartFelt lead pipeline categories?',
              options: ['Buyer, Seller, Investor, Builder', 'Hot, Warm, Nurture, Cold', 'Paid, Organic, Referral, Walk-in', 'Active, Pending, Closed, Lost'],
              correct_answer: 1
            },
            {
              id: 'q2-3',
              question: 'How often should "Warm" leads be followed up?',
              options: ['Daily', 'Weekly', 'Monthly', 'Quarterly'],
              correct_answer: 1
            },
            {
              id: 'q2-4',
              question: 'What is the goal of the 7-Day Conversion Challenge?',
              options: ['Create social content', 'One appointment per ~20 real conversations', 'Make 100 calls per day', 'Run paid ads'],
              correct_answer: 1
            },
            {
              id: 'q2-5',
              question: 'True or False: Leads should be deleted if they are not ready to buy now.',
              options: ['True', 'False'],
              correct_answer: 1
            }
          ]
        },
        {
          id: 3,
          title: 'Module 3: Listing Systems',
          content: `LISTING SYSTEMS

SELLER PROCESS & LISTING DISCIPLINE
A listing is not a listing until it's strategically positioned, competitively priced, and aggressively marketed.

THE LISTING WORKFLOW

Phase 1: Pre-Listing (Before the Agreement)
• Comp analysis - 9 comps (3 active, 3 pending, 3 sold)
• Property walkthrough and condition assessment
• Photography and marketing plan
• Competitive positioning memo
• Seller's pricing expectation alignment

Phase 2: Listing Agreement & Pricing
Responsibility: You are responsible for setting expectations, not just taking the listing.

If a seller insists on listing above market value:
• Present data and align expectations
• Show the 9-comp analysis
• Explain days-on-market implications
• Set the expectation: "We list at market. Overpriced listings don't sell."

Your job is to guide, not to agree with everything.

THE HARTFELT PRICING FRAMEWORK
• Pull 3 active listings in the same price range
• Pull 3 pending (under contract) in the same range
• Pull 3 sold comps from the past 90 days

Calculate: Average $/SqFt across all 9 = fair market value
Your listing price = subject property's sqft × $/SqFt average

This is not opinion. This is data.

BUYER URGENCY WINDOW
Research shows: Buyer urgency is strongest in the first 14 days after a listing launches.

Days 1-14: 65% of all showings occur here
Days 15-30: 20% of showings
Days 31+: 15% remaining (declining every week)

What this means: Your marketing push must be AGGRESSIVE in week 1.

MANDATORY MARKETING ELEMENTS
Every HartFelt listing must include:
✓ Professional photography (not phone photos)
✓ Virtual tour or video walkthrough
✓ Compelling written description
✓ Showings available within 48 hours of listing
✓ Daily market/feedback loop
✓ Broker open house (if appropriate)

THE HARTFELT LISTING AGREEMENT
Always use: Exclusive Right-to-Sell
• Protects you legally
• Commits the seller
• Ensures you earn commission
Never use "Exclusive Agency" or "Open Listing"

PRICE REDUCTIONS
Price reductions should be strategic and data-driven, not reactive.

When to reduce:
• After 14 days with low showing activity
• When 30+ days on market with no offers
• When comps shift (new sales come in lower)
• When feedback indicates overpricing

How much to reduce:
• Small strategic drop: 2-3%
• Reset the market: 5-8%
• Competitive repricing: 8-15%

Goal: Attract fresh buyer interest and create urgency.`,
          questions: [
            {
              id: 'q3-1',
              question: 'What is your responsibility if a seller insists on listing above market value?',
              options: ['Agree to keep the client happy', 'Let the market decide', 'Present data and align expectations', 'Ignore the objection'],
              correct_answer: 2
            },
            {
              id: 'q3-2',
              question: 'How many comps are required in the HartFelt pricing framework?',
              options: ['3 total', '6 total', '9 total (3 active, 3 pending, 3 sold)', 'Unlimited'],
              correct_answer: 2
            },
            {
              id: 'q3-3',
              question: 'When is buyer urgency strongest after a listing launches?',
              options: ['First 90 days', 'First 30 days', 'First 14 days', 'After a price reduction'],
              correct_answer: 2
            },
            {
              id: 'q3-4',
              question: 'What is mandatory in the HartFelt marketing plan?',
              options: ['Flyers', 'Social media posts', 'Professional photography', 'Open house'],
              correct_answer: 2
            },
            {
              id: 'q3-5',
              question: 'What is the HartFelt default listing agreement?',
              options: ['Exclusive Agency', 'Open Listing', 'Exclusive Right-to-Sell', 'Buyer Agency'],
              correct_answer: 2
            }
          ]
        },
        {
          id: 4,
          title: 'Module 4: Buyer Experience',
          content: `BUYER EXPERIENCE

CREATE EXCEPTIONAL EXPERIENCES FOR BUYER CLIENTS

THE BUYER CONSULTATION FRAMEWORK
Before you show a single home, you must have a structured buyer consultation.

Purpose: Build trust, align expectations, and qualify the buyer.

THE 3-PART CONSULTATION

Part 1: Financial Clarity (First 15 minutes)
• Pre-approval or proof of funds verification
• Budget confirmation
• Down payment and closing costs review
• Loan structure (conventional, FHA, etc.)
• Timeline expectations

Part 2: Preference & Motivation (Next 15 minutes)
• What neighborhoods appeal to them?
• Property type (condo, townhouse, single-family, etc.)
• Commute considerations
• Schools, lifestyle, amenities
• What's driving the move NOW? (not later)

Part 3: The Strategy (Final 15 minutes)
• Showing strategy and next steps
• Timeline for offers
• Contingency management
• Communication expectations
• What makes them confident to make an offer

Key: Listen more than you talk. Questions build trust. Pitches build resistance.

SHOWING STRATEGY

Before Showings:
✓ Verify pre-approval or proof of funds
✓ Confirm property access and showing availability
✓ Scout the property beforehand
✓ Prepare your route and parking
✓ Have comps and market data ready

During Showings:
• Stay calm and neutral (emotions are temporary)
• Ask questions, don't oversell features
• Point out what's there, not what could be there
• Use data-based framing: "This home is in the top 10% for appreciation"
• Avoid being salesy - let the property speak

Frame buyers with data, not emotion.

OFFER NEGOTIATION & STRATEGY

Before Writing an Offer:
Discuss with the buyer:
• Comparable sales in the area
• Market strategy (beat a competing offer or strategic lowball?)
• Escalation clauses if needed
• Contingencies and inspection scope
• Inspection timeline and communication plan

Writing the Offer:
• Research recent closed comps in the neighborhood
• Price strategy: at market, below market, or above?
• Include contingencies appropriately
• Earnest money deposit amount and timeline
• Closing timeline expectations

After the Offer:
• Communicate the seller's response immediately
• Manage counter-offer strategy
• Keep inspection focused (safety, structure, systems - not cosmetics)
• Stay in control of the narrative

MANAGING BUYER EMOTIONS

Rule: Buyer emotions should INFORM decisions, not DRIVE them.

Your job is to guide with discipline:
• "I love the property too, but let's look at the numbers first."
• "We can make this offer, but here's what that means for your financial position."
• "This deal makes sense from a data perspective. Let's move forward strategically."

Calm, data-based guidance separates professionals from amateurs.`,
          questions: [
            {
              id: 'q4-1',
              question: 'What must be verified before scheduling showings?',
              options: ['Favorite neighborhoods', 'Pre-approval or proof of funds', 'Social media presence', 'Credit score only'],
              correct_answer: 1
            },
            {
              id: 'q4-2',
              question: 'What is the primary goal of the Buyer Consultation?',
              options: ['Show houses', 'Build trust and align expectations', 'Collect a retainer', 'Push urgency'],
              correct_answer: 1
            },
            {
              id: 'q4-3',
              question: 'How should buyers be guided during showings?',
              options: ['Oversell features', 'Stay silent', 'Calm, neutral, data-based framing', 'Pressure offers'],
              correct_answer: 2
            },
            {
              id: 'q4-4',
              question: 'What must be discussed before writing an offer?',
              options: ['Paint colors', 'Comps, strategy, and escalation clauses', 'Furniture', 'Curb appeal'],
              correct_answer: 1
            },
            {
              id: 'q4-5',
              question: 'True or False: Buyer emotions should drive decisions.',
              options: ['True', 'False'],
              correct_answer: 1
            }
          ]
        },
        {
          id: 5,
          title: 'Module 5: Transaction to Close',
          content: `TRANSACTION TO CLOSE

MANAGE EVERY DETAIL. CONTROL EVERY DEADLINE.

THE TRANSACTION TIMELINE
From contract to closing, you control the narrative. One missed deadline collapses the entire timeline.

CRITICAL DEADLINES

Day 1: Contract Acceptance
• Enter all dates into your system IMMEDIATELY
• Confirm with buyer and seller
• Set calendar alerts for every milestone

Days 3-5: Inspection Period
• Coordinate the inspection
• Review inspection report within 24 hours
• Communicate findings to buyer
• Manage seller response

Days 7-14: Appraisal & Financing
• Confirm lender has received appraisal order
• Monitor appraisal status
• Address any appraisal issues early
• Track loan progress weekly

Days 30-45: Final Walkthrough & Closing Prep
• Schedule final walkthrough 24-48 hours before closing
• Confirm closing date with title company
• Verify all contingencies are satisfied
• Prepare buyer for closing costs and documents

Day of Closing: Execution
• Be present or available
• Confirm all documents are executed
• Coordinate wire transfers
• Celebrate the win

THE PRE-CLOSING HUDDLE (3 DAYS BEFORE CLOSING)
This is non-negotiable.

Attendees: You, the buyer (if possible), and the lender
Discussion points:
• Final walkthrough date/time
• Closing timeline and location
• All costs and final figures
• Keys and move-in logistics
• Any last-minute concerns

This huddle prevents closing disasters.

INSPECTION FOCUS
The inspection should reveal: Safety, Structure, Systems (not cosmetics).

Focus on:
✓ Electrical systems
✓ Plumbing and water
✓ HVAC and heating
✓ Foundation and structural integrity
✓ Roof condition and age

Don't focus on:
✗ Paint color
✗ Carpet condition
✗ Light fixtures
✗ Landscaping

Negotiations after inspection should be about safety and functionality, not aesthetics.

MANAGING CONTINGENCIES
Every contingency must have a resolution date.

Common contingencies:
• Inspection contingency (7-10 days)
• Appraisal contingency (dependent on lender)
• Financing contingency (dependent on underwriting)
• Repair contingency (if applicable)

Your job: Keep all contingencies on track. No surprises at closing.

COMMUNICATION PROTOCOL
Rule: No one should ever need to ask you for a transaction update.

Weekly communication:
• Email update to buyer and seller
• Status: "On track for closing on [date]"
• Any issues? Call immediately
• No issues? Brief email is fine

Keep everyone informed. Reduce anxiety. Control the deal.`,
          questions: [
            {
              id: 'q5-1',
              question: 'When should contract dates be entered into the system?',
              options: ['After inspection', 'After closing', 'Immediately after acceptance', 'Only if lender asks'],
              correct_answer: 2
            },
            {
              id: 'q5-2',
              question: 'What happens when one milestone slips?',
              options: ['Nothing', 'The closing timeline collapses', 'Title fixes it', 'The lender delays automatically'],
              correct_answer: 1
            },
            {
              id: 'q5-3',
              question: 'Inspection focus should be on:',
              options: ['Cosmetic items', 'Buyer emotions', 'Safety, structure, and systems', 'Negotiation tactics'],
              correct_answer: 2
            },
            {
              id: 'q5-4',
              question: 'When should the pre-closing huddle occur?',
              options: ['Day of closing', '3 days before closing', 'After walkthrough', 'After funding'],
              correct_answer: 1
            },
            {
              id: 'q5-5',
              question: 'True or False: No one should ever need to ask you for a transaction update.',
              options: ['True', 'False'],
              correct_answer: 0
            }
          ]
        },
        {
          id: 6,
          title: 'Module 6: Marketing & Social Branding',
          content: `MARKETING & SOCIAL BRANDING

BUILD YOUR BRAND. CONVERT YOUR AUDIENCE.

THE THREE PILLARS OF HARTFELT BRANDING
Every piece of content you create should reinforce one of these:

1. Authority
   Show you know your market. Market data, comps, trends, neighborhood expertise.
   Content: Market reports, price analyses, investment guides, local insights.

2. Authenticity
   Be real. Share your process, your struggles, your wins. Build trust through transparency.
   Content: Client stories, behind-the-scenes, day-in-the-life, testimonials.

3. Aesthetic
   Your visuals represent your standard. Professional photos, consistent branding, polished design.
   Content: Property photography, professional headshots, designed graphics, video.

WEEKLY CONTENT FRAMEWORK
Minimum 3 content categories per week:

Category 1: Educational (Authority)
• Market tips
• Buyer/seller guides
• Investment insights
• Neighborhood profiles
Target: Position yourself as the expert.

Category 2: Lifestyle (Authenticity)
• Client stories
• Community involvement
• Personal growth
• Day-in-the-life
Target: Build relationship and trust.

Category 3: Listings & Transactions (Conversion)
• New listings
• Sold showcases
• Open house announcements
• Testimonials
Target: Drive business.

THE HARTFELT BRAND VOICE
Confident, warm, precise.
Not casual. Not aggressive. Not salesy.
Example: "Here's what the data shows about [neighborhood]..." vs. "You MUST buy this house NOW!"

CONTENT PILLARS FOR LISTINGS
Every listing gets 5-7 pieces of content:

1. Professional photography (10-15 photos, curated)
2. Virtual tour or video walkthrough
3. Market position post ("Why this property matters in this market")
4. Neighborhood guide ("What you need to know about this area")
5. Sold comparables ("Here's what similar properties sold for")
6. Agent narrative ("My perspective on this property")
7. Open house or viewing announcement

PLATFORM STRATEGY
Where to post and why:

Instagram: Lifestyle + listings (visual-heavy, aesthetic focus)
Facebook: Community + testimonials (relationship-building, stories)
LinkedIn: Market insights + credibility (authority positioning)
YouTube: Long-form content (walkthroughs, market analysis)
TikTok: Trends + personality (if age-appropriate for your brand)

Don't post everywhere. Master 2-3 platforms first.`,
          questions: [
            {
              id: 'q6-1',
              question: 'What are the three pillars of HartFelt branding?',
              options: ['Leads, Listings, Luxury', 'Authority, Authenticity, Aesthetic', 'Growth, Sales, Referrals', 'Content, Reels, Email'],
              correct_answer: 1
            },
            {
              id: 'q6-2',
              question: 'How many weekly content categories are required?',
              options: ['1', '2', '3', 'Unlimited'],
              correct_answer: 2
            },
            {
              id: 'q6-3',
              question: 'What is the HartFelt brand voice?',
              options: ['Casual and trendy', 'Aggressive and salesy', 'Confident, warm, precise', 'Humorous and viral'],
              correct_answer: 2
            },
            {
              id: 'q6-4',
              question: 'What is the purpose of lifestyle content?',
              options: ['Show off', 'Dilute brand', 'Humanize the brand and build trust', 'Avoid real estate topics'],
              correct_answer: 2
            },
            {
              id: 'q6-5',
              question: 'True or False: Luxury buyers purchase based on specs more than narrative and positioning.',
              options: ['True', 'False'],
              correct_answer: 1
            }
          ]
        },
        {
          id: 7,
          title: 'Module 7: Growth & Retention',
          content: `GROWTH & RETENTION

SYSTEMS, HABITS, AND ACCOUNTABILITY

THE HARTFELT GROWTH PHILOSOPHY
Growth isn't luck. It isn't viral moments. It isn't paid ads (alone).

Growth = Systems + Habits + Accountability

WEEKLY KPI TRACKING
Every HartFelt agent tracks 4 core KPIs:

1. Leads Generated
   Where are they coming from? Track source.
   Goal: 20+ qualified leads per week.

2. Conversations Had
   How many real conversations? (not calls, conversations)
   Goal: 40+ real conversations per week.

3. Appointments Set
   How many buyer/seller consultations?
   Goal: 4+ appointments per week.

4. Contracts Signed
   New listings? New buyer contracts?
   Goal: 2-3 new contracts per week.

Track these in a spreadsheet. Review weekly. Adjust daily.

THE HARTFELT GROWTH FORMULA
Leads → Conversations → Appointments → Contracts → Closings

This is the funnel. Every stage matters.

If you're not getting closings: Which stage is breaking?
• No leads? Fix prospecting.
• Lots of leads but no conversations? Fix follow-up.
• Conversations but no appointments? Fix qualification.
• Appointments but no contracts? Fix presentation.
• Contracts but no closings? Fix transaction management.

RETENTION & REFERRAL STRATEGY
Your past clients are your best source of business.

Post-Closing Touchpoints:

30 days: "Congratulations" card or call
90 days: Home maintenance tips email
6 months: Home value update
12 months: Anniversary check-in (not just at closing)
Quarterly: Market update email

How to Ask for Referrals:
NOT: "Can you send me referrals?"
YES: "We just helped your neighbor [Name] sell their home. If you know anyone looking to buy or sell, we'd love to help them the same way."

Make the ask natural. Provide value first. Ask for referrals as a byproduct of relationship.

REFERRAL PARTNERSHIPS
Build strategic partnerships with:
• Lenders (share leads, build relationships)
• Contractors (home inspection, repairs, renovations)
• Attorneys (legal referrals for transactions)
• Title companies (closing coordination)
• Insurance agents (homeowner insurance referrals)

Trade leads. Collaborate. Win together.

YOUR ANNUAL BUSINESS REVIEW
Every 12 months, review:

1. Total transactions
2. Total revenue
3. Lead sources (what worked, what didn't)
4. Client retention rate
5. Referral rate
6. Marketing spend vs. ROI
7. Partnerships and collaborations
8. Personal growth and learning

Use this to plan next year. What's your goal? How will you get there?

HARTFELT READINESS CHECKLIST
Before you complete this volume, you should be able to:

✓ Run 9-comp analysis
✓ Write a persuasive listing agreement
✓ Manage a buyer consultation
✓ Handle an objection with data
✓ Manage a transaction timeline
✓ Create a weekly content plan
✓ Track your KPIs and adjust

This isn't about memorization. This is about capability. Can you execute? That's the standard.`,
          questions: [
            {
              id: 'q7-1',
              question: 'What is HartFelt\'s philosophy on growth?',
              options: ['Luck', 'Paid leads', 'Systems, habits, and accountability', 'Viral marketing'],
              correct_answer: 2
            },
            {
              id: 'q7-2',
              question: 'What should agents track weekly?',
              options: ['Social likes', 'KPIs (leads, appointments, contracts, closings)', 'Competitor listings', 'Market gossip'],
              correct_answer: 1
            },
            {
              id: 'q7-3',
              question: 'What is the HartFelt growth formula?',
              options: ['Leads → Ads → Closings', 'Conversations → Listings → Luxury', 'Leads → Conversations → Appointments → Contracts → Closings', 'Marketing → Branding → Referrals'],
              correct_answer: 2
            },
            {
              id: 'q7-4',
              question: 'How often should past clients be touched post-closing?',
              options: ['Never', 'Only at closing', 'Quarterly and annually', 'Only if they call'],
              correct_answer: 2
            },
            {
              id: 'q7-5',
              question: 'True or False: Referrals should be requested aggressively.',
              options: ['True', 'False'],
              correct_answer: 1
            }
          ]
        },
        {
          id: 8,
          title: 'Module 8: AI for Real Estate',
          content: `AI FOR REAL ESTATE

"Close Smarter. Move Faster. Scale Yourself."

THE AI MINDSET
Agents who learn how to use AI are going to dominate this industry. Not in five years. Right now.

This isn't about replacing you. This is about multiplying you. Instead of doing everything yourself, you now have a system that can think with you, write with you, and help you move faster than everyone else.

AI is not here to replace real estate agents. It's here to replace slow agents. The agents who win are the ones who respond faster, communicate better, and stay consistent. AI helps you do all three without burning out.

CHATGPT VS CLAUDE
You don't need 10 tools. You need to know how to use the right two.

ChatGPT - Best for:
• Fast responses and text messages
• Scripts and listing descriptions
• Roleplay practice

Claude - Best for:
• Long documents and reviewing contracts
• Summarizing information
• More natural writing tone

The Rule: Use ChatGPT when you need speed. Use Claude when you need depth. Master both.

PROMPTING LIKE A PRO
This is the difference between agents who "try AI" and agents who actually use it. Every strong result comes from a strong prompt.

The 4-Part Formula:
1. Role - Tell AI who it is
2. Task - Tell AI what to do
3. Context - Give relevant details
4. Tone - Set the voice and style

Example: "You are a luxury real estate agent in Miami. Write a listing description for a waterfront home with private lake access. Make it confident, elegant, and high-end."

If your result is weak, your prompt was weak.

REAL ESTATE USE CASES

Listing Side:
• Write listing descriptions in seconds
• Create open house scripts
• Generate Instagram captions
• Draft email blasts

Buyer Side:
• Recommend properties based on criteria
• Write follow-up texts
• Handle objections with AI coaching

Lead Conversion:
• Reactivate old leads
• Send personalized cold outreach
• Stay consistent with communication

DAILY AI WORKFLOW

Morning:
• Generate follow-ups for leads
• Plan your day with AI assistance

Midday:
• Create social content
• Write listing materials

Night:
• Recap your day
• Plan tomorrow's priorities

Agents who win don't guess what to do next. They execute with clarity.

AI ROLEPLAY
You can practice real conversations using AI:
• "Act like a seller who thinks the price is too low."
• "Act like a buyer who is hesitant to move forward."
• "Challenge me on my commission."

This allows you to practice without pressure. By the time you're in a real conversation, you've already handled it before.

WHAT NOT TO DO WITH AI
• Copying and pasting without editing
• Sounding robotic in client communications
• Trusting AI without verifying facts
• Using AI for legal advice

AI should enhance your voice — not replace it.

MAKING MONEY WITH AI
AI helps you:
• Respond faster → More conversions
• Market better → More listings
• Communicate clearly → Stronger relationships

The agent who responds first usually wins. AI makes sure that's you.`,
          questions: [
            {
              id: 'q8-1',
              question: 'What is the primary purpose of AI for real estate agents?',
              options: ['Replace agents entirely', 'Multiply your capabilities', 'Automate all communication', 'Generate leads only'],
              correct_answer: 1
            },
            {
              id: 'q8-2',
              question: 'When should you use ChatGPT vs Claude?',
              options: ['ChatGPT for everything', 'ChatGPT for speed, Claude for depth', 'Claude for everything', 'Neither — use Google'],
              correct_answer: 1
            },
            {
              id: 'q8-3',
              question: 'What is the 4-part prompting formula?',
              options: ['Who, What, When, Where', 'Role, Task, Context, Tone', 'Input, Process, Output, Review', 'Ask, Wait, Copy, Paste'],
              correct_answer: 1
            },
            {
              id: 'q8-4',
              question: 'What should you AVOID doing with AI?',
              options: ['Writing listing descriptions', 'Practicing objection handling', 'Copying and pasting without editing', 'Generating follow-up texts'],
              correct_answer: 2
            },
            {
              id: 'q8-5',
              question: 'How does AI help agents make more money?',
              options: ['By replacing client meetings', 'By responding faster, marketing better, and communicating clearly', 'By automating all negotiations', 'By generating fake reviews'],
              correct_answer: 1
            }
          ]
        }
      ],
      finalExam: [
        { id: 'final-1', question: 'HartFelt defines luxury as:', options: ['High price point', 'Premium finishes', 'Behavior, precision, and execution', 'Square footage'], correct_answer: 2 },
        { id: 'final-2', question: 'Client response standard is:', options: ['72 hours', 'Business hours only', 'Same day or within 24 hours', 'When convenient'], correct_answer: 2 },
        { id: 'final-3', question: 'Minimum comps required:', options: ['1–2', '3–5', '10+', 'Any number'], correct_answer: 1 },
        { id: 'final-4', question: 'Lead contact speed should be:', options: ['1 hour', 'Same day', 'Within 5 minutes', 'Next business day'], correct_answer: 2 },
        { id: 'final-5', question: 'HartFelt lead stages are:', options: ['Buyer, Seller, Investor', 'Hot, Warm, Nurture, Cold', 'Paid, Organic, Referral', 'Active, Pending, Closed'], correct_answer: 1 },
        { id: 'final-6', question: 'HartFelt comp framework:', options: ['3 comps', '6 comps', '9 comps (3 active, 3 pending, 3 sold)', 'Unlimited'], correct_answer: 2 },
        { id: 'final-7', question: 'Buyer urgency window is:', options: ['90 days', '30 days', 'First 14 days', 'After price drop'], correct_answer: 2 },
        { id: 'final-8', question: 'Before showings, verify:', options: ['Neighborhood', 'Pre-approval or proof of funds', 'Credit score only', 'Social media'], correct_answer: 1 },
        { id: 'final-9', question: 'Buyer consultation goal:', options: ['Show homes', 'Collect retainer', 'Align expectations and build trust', 'Create urgency'], correct_answer: 2 },
        { id: 'final-10', question: 'Inspection focus:', options: ['Cosmetic', 'Emotions', 'Safety, structure, systems', 'Negotiation'], correct_answer: 2 },
        { id: 'final-11', question: 'Contract dates should be entered:', options: ['After inspection', 'After closing', 'Immediately after acceptance', 'If lender asks'], correct_answer: 2 },
        { id: 'final-12', question: 'Pre-closing huddle timing:', options: ['Day of closing', '3 days before', 'After walkthrough', 'After funding'], correct_answer: 1 },
        { id: 'final-13', question: 'Marketing must include:', options: ['Flyers', 'Social posts', 'Professional photography', 'Open house'], correct_answer: 2 },
        { id: 'final-14', question: 'HartFelt branding pillars:', options: ['Leads, Listings, Luxury', 'Authority, Authenticity, Aesthetic', 'Growth, Sales, Referrals', 'Content, Reels, Email'], correct_answer: 1 },
        { id: 'final-15', question: 'Weekly content categories:', options: ['1', '2', '3', 'Unlimited'], correct_answer: 2 },
        { id: 'final-16', question: 'Growth philosophy is:', options: ['Luck', 'Paid leads', 'Systems, habits, accountability', 'Viral'], correct_answer: 2 },
        { id: 'final-17', question: 'Track weekly KPIs:', options: ['Social likes', 'Leads, conversations, appointments, contracts', 'Competitor listings', 'Market gossip'], correct_answer: 1 },
        { id: 'final-18', question: 'Growth formula:', options: ['Leads → Ads → Closings', 'Leads → Conversations → Appointments → Contracts → Closings', 'Marketing → Branding → Referrals', 'Content → Followers → Sales'], correct_answer: 1 },
        { id: 'final-19', question: 'Past client touchpoints:', options: ['Never', 'Only at closing', 'Quarterly and annually', 'Only if they call'], correct_answer: 2 },
        { id: 'final-20', question: 'Luxury buyers value:', options: ['Specs only', 'Price', 'Narrative and positioning', 'Market hype'], correct_answer: 2 },
        { id: 'final-21', question: 'Listing agreement type:', options: ['Open', 'Exclusive agency', 'Exclusive right-to-sell', 'Buyer agency'], correct_answer: 2 },
        { id: 'final-22', question: 'Showing preparation includes:', options: ['Just show up', 'Scout property beforehand', 'Use buyer\'s recommendations', 'List all details'], correct_answer: 1 },
        { id: 'final-23', question: 'Inspection reveals:', options: ['Cosmetics', 'Buyer taste', 'Safety, structure, systems', 'Design'], correct_answer: 2 },
        { id: 'final-24', question: 'Offer strategy discussion:', options: ['Just write it', 'Comps, strategy, escalation clauses', 'Let buyer decide', 'Follow market'], correct_answer: 1 },
        { id: 'final-25', question: 'Transaction control means:', options: ['React to issues', 'Anticipate and control', 'Delegate everything', 'Let lender decide'], correct_answer: 1 },
        { id: 'final-26', question: 'AI purpose for agents:', options: ['Replace agents', 'Multiply capabilities', 'Automate everything', 'Generate leads only'], correct_answer: 1 },
        { id: 'final-27', question: 'ChatGPT vs Claude rule:', options: ['ChatGPT only', 'ChatGPT for speed, Claude for depth', 'Claude only', 'Neither'], correct_answer: 1 },
        { id: 'final-28', question: 'Prompting formula:', options: ['Who, What, When, Where', 'Role, Task, Context, Tone', 'Input, Output, Review', 'Ask, Copy, Paste'], correct_answer: 1 },
        { id: 'final-29', question: 'AI mistake to avoid:', options: ['Writing descriptions', 'Roleplay practice', 'Copy-paste without editing', 'Generating follow-ups'], correct_answer: 2 },
        { id: 'final-30', question: 'AI daily workflow includes:', options: ['Use once a month', 'Morning follow-ups, midday content, evening recap', 'Only for listings', 'Only when stuck'], correct_answer: 1 },
      ]
    },
    'volume-2': {
      id: 'volume-2',
      title: 'HartFelt Ready™ Volume 2',
      description: 'Advanced strategies and client management techniques',
      locked: true,
      password: 'HartFelt2024',
      modules: [],
      finalExam: []
    },
    'volume-3': {
      id: 'volume-3',
      title: 'HartFelt Ready™ Volume 3',
      description: 'Growth strategies and business development',
      locked: true,
      password: 'HartFelt2024',
      modules: [],
      finalExam: []
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    // Use the shared Supabase client (has session persistence + auth)
    setSupabase(sharedSupabase)

    if (user) {
      loadProgress(sharedSupabase)
    }
  }, [user])

  const loadProgress = async (client: any) => {
    try {
      const { data, error } = await client
        .from('training_progress')
        .select('*')
        .eq('user_id', user?.id)
        .eq('volume', 'volume-1')
        .single()

      if (data) {
        setProgress(data)
      }
    } catch (err) {
      console.log('No progress found, starting fresh')
    }
  }

  // Load videos for a module via server-side API (bypasses RLS)
  const loadModuleVideos = async (moduleNum: number, volumeNum: number = 1) => {
    try {
      const moduleId = `m_v${volumeNum}_${String(moduleNum).padStart(2, '0')}`
      const res = await fetch(`/api/training/module-videos?module_id=${encodeURIComponent(moduleId)}`)
      const json = await res.json()

      if (!res.ok || !json.videos) {
        console.log('No videos found for module:', moduleId, json)
        setModuleVideos([])
        return
      }

      setModuleVideos(json.videos)
      setCurrentVideoIdx(0)
      setAllVideosWatched(false)
      setSignedVideoUrl(null)

      // Load the first video's signed URL
      if (json.videos.length > 0) {
        await loadSignedUrl(json.videos[0].r2_key_en || json.videos[0].r2_key_es)
      }
    } catch (err) {
      console.log('Failed to load module videos:', err)
      setModuleVideos([])
    }
  }

  // Fetch a signed URL for R2 video playback
  const loadSignedUrl = async (r2Key: string | null) => {
    if (!r2Key) {
      setSignedVideoUrl(null)
      return
    }
    setVideoLoading(true)
    try {
      const res = await fetch(`/api/training/sign-video?key=${encodeURIComponent(r2Key)}`)
      const json = await res.json()
      setSignedVideoUrl(json.url || null)
    } catch (err) {
      console.log('Failed to get signed URL:', err)
      setSignedVideoUrl(null)
    } finally {
      setVideoLoading(false)
    }
  }

  // Handle advancing to the next video in the module
  const handleNextVideo = async () => {
    const nextIdx = currentVideoIdx + 1
    if (nextIdx < moduleVideos.length) {
      setCurrentVideoIdx(nextIdx)
      const nextVid = moduleVideos[nextIdx]
      await loadSignedUrl(nextVid.r2_key_en || nextVid.r2_key_es)
      // Auto-unlock test button when reaching the last video
      if (nextIdx === moduleVideos.length - 1) {
        setAllVideosWatched(true)
      }
    } else {
      // All videos watched (fallback for single-video modules)
      setAllVideosWatched(true)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleVolumeSelect = (volume: Volume) => {
    if (volumeData[volume].locked) {
      setShowPasswordPrompt(true)
      setCurrentVolume(volume)
    } else {
      setCurrentVolume(volume)
      setScreen('modules')
    }
  }

  const handlePasswordSubmit = () => {
    if (currentVolume && passwordInput === volumeData[currentVolume].password) {
      setShowPasswordPrompt(false)
      setPasswordInput('')
      setScreen('modules')
    } else {
      setAlertMessage('Incorrect password')
      setShowAlert(true)
    }
  }

  const handleStartModule = (moduleId: number) => {
    // Check if previous modules are completed (except for module 1)
    if (moduleId > 1) {
      const previousModuleCompleted = progress?.completed_modules?.includes(moduleId - 1)
      if (!previousModuleCompleted) {
        setAlertMessage(`⚠️ You must complete Module ${moduleId - 1} before starting Module ${moduleId}.`)
        setShowAlert(true)
        return
      }
    }

    setCurrentModule(moduleId)
    setScreen('module-content')
    setTestAnswers({})
    setContentScrollPos(0)

    // Load videos for this module from Supabase
    const volumeNum = currentVolume === 'volume-1' ? 1 : currentVolume === 'volume-2' ? 2 : 3
    loadModuleVideos(moduleId, volumeNum)
  }

  const handleContentComplete = () => {
    setScreen('module-test')
    setTestAnswers({})
  }

  const handleTestAnswer = (questionId: string, answerIndex: number) => {
    setTestAnswers({
      ...testAnswers,
      [questionId]: answerIndex
    })
  }

  const handleSubmitModuleTest = async () => {
    if (!currentVolume) return

    const volume = volumeData[currentVolume]
    const module = volume.modules.find(m => m.id === currentModule)
    if (!module) return

    // Check if all questions are answered
    const allAnswered = module.questions.every(q => testAnswers[q.id] !== undefined)
    if (!allAnswered) {
      setAlertMessage('⚠️ Please answer all questions before submitting.')
      setShowAlert(true)
      return
    }

    const correct = module.questions.filter(q => testAnswers[q.id] === q.correct_answer).length
    const score = Math.round((correct / module.questions.length) * 100)

    setTestScore(score)

    if (score >= 80) {
      setAlertMessage(`🎉 Pass! Module ${currentModule} Complete - Score: ${score}%`)
      setShowAlert(true)

      // Update local progress immediately
      const updatedCompleted = [...new Set([...(progress?.completed_modules || []), currentModule])]
      const updatedScores = { ...progress?.test_scores, [`module-${currentModule}`]: score }

      setProgress({
        user_id: user?.id || '',
        volume: currentVolume,
        module: currentModule,
        completed_modules: updatedCompleted,
        test_scores: updatedScores,
        volume_completed: false
      })

      // Save to Supabase in background
      if (supabase && user) {
        try {
          await supabase.from('training_progress').upsert({
            user_id: user.id,
            volume: currentVolume,
            module: currentModule,
            test_scores: updatedScores,
            completed_modules: [...new Set(updatedCompleted)]
          })
        } catch (err) {
          console.error('Failed to save progress:', err)
          // Still show success even if saving fails - data is in local state
        }
      }

      setTimeout(() => {
        setShowAlert(false)
        setScreen('modules')
      }, 3000)
    } else {
      setAlertMessage(`❌ Score: ${score}%. You need 80% to pass. Try again!`)
      setShowAlert(true)
      // Don't clear answers - let them review their answers
      // setTestAnswers({})
    }
  }

  const handleStartFinalExam = () => {
    setTestAnswers({})
    setScreen('final-exam')
  }

  const handleSubmitFinalExam = async () => {
    if (!currentVolume) return

    const volume = volumeData[currentVolume]

    // Check if all questions are answered
    const allAnswered = volume.finalExam.every(q => testAnswers[q.id] !== undefined)
    if (!allAnswered) {
      setAlertMessage('⚠️ Please answer all questions before submitting.')
      setShowAlert(true)
      return
    }

    const correct = volume.finalExam.filter(q => testAnswers[q.id] === q.correct_answer).length
    const score = Math.round((correct / volume.finalExam.length) * 100)

    setTestScore(score)

    if (score >= 85) {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      setCertificateData({
        name: user?.user_metadata?.name || user?.email || 'Agent',
        score,
        date: today
      })

      setAlertMessage(`🏆 CERTIFIED! Final Exam Score: ${score}%`)
      setShowAlert(true)

      if (supabase && user) {
        try {
          await supabase.from('training_progress').upsert({
            user_id: user.id,
            volume: currentVolume,
            volume_completed: true,
            final_exam_score: score,
            certification_date: today
          })
        } catch (err) {
          console.error('Failed to save certification:', err)
        }
      }

      setTimeout(() => {
        setShowAlert(false)
        setScreen('certificate')
      }, 3000)
    } else {
      setAlertMessage(`❌ Score: ${score}%. You need 85% to pass the certification exam. Try again!`)
      setShowAlert(true)
      // Don't clear answers - let them review
      // setTestAnswers({})
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {screen === 'volumes' ? 'HartFelt Ready Training' :
               currentVolume ? `${volumeData[currentVolume].title}` : 'Training'}
            </h1>
            <p className="text-gray-600 text-sm mt-1">HartFelt Ready™ Training Program</p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Alert */}
      {showAlert && (
        <div className="mx-auto max-w-7xl px-6 py-3 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="text-green-800">{alertMessage}</span>
            <button
              onClick={() => setShowAlert(false)}
              className="ml-auto text-green-600 hover:text-green-700 font-medium text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Volumes Screen */}
        {screen === 'volumes' && (
          <div>
            <p className="text-gray-600 text-lg mb-8">
              Select a training volume to begin. Complete all modules and pass the final certification exam (85%) to earn your HartFelt Ready certification.
            </p>
            <div className="grid grid-cols-3 gap-6">
              {Object.values(volumeData).map(volume => (
                <div key={volume.id} className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden">
                  <div className="h-40 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center relative">
                    <div className="flex flex-col items-center justify-center">
                      <img src="/logo.png" alt="HartFelt Ready" className="w-16 h-16 object-contain mb-2" />
                      <p className="text-white text-sm font-bold">HartFelt Ready™</p>
                    </div>
                    {volume.locked && <Lock className="w-6 h-6 text-red-300 absolute top-4 right-4" />}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{volume.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{volume.description}</p>
                    <p className="text-sm text-gray-500 mb-6">{volume.modules.length} modules</p>
                    <button
                      onClick={() => handleVolumeSelect(volume.id as Volume)}
                      className={`w-full py-2 rounded-lg transition font-medium ${
                        volume.locked
                          ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      disabled={volume.locked}
                    >
                      {volume.locked ? 'Locked' : 'Start'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Password Prompt */}
        {showPasswordPrompt && (
          <div className="max-w-md mx-auto bg-white rounded-lg shadow p-8">
            <Lock className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Volume Locked</h2>
            <p className="text-gray-600 mb-6">This volume is password protected. Enter the password to access.</p>
            <input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex gap-3">
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Unlock
              </button>
              <button
                onClick={() => {
                  setShowPasswordPrompt(false)
                  setPasswordInput('')
                  setCurrentVolume(null)
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Modules List */}
        {screen === 'modules' && currentVolume && (
          <div>
            <div className="mb-8">
              <button
                onClick={() => {
                  setScreen('volumes')
                  setCurrentVolume(null)
                }}
                className="text-blue-600 hover:text-blue-700 font-medium mb-4"
              >
                ← Back to Volumes
              </button>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{volumeData[currentVolume].title}</h2>
              <p className="text-gray-600">{volumeData[currentVolume].description}</p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-12">
              {volumeData[currentVolume].modules.map(module => {
                const isCompleted = progress?.completed_modules?.includes(module.id)
                const canAccess = module.id === 1 || progress?.completed_modules?.includes(module.id - 1)

                return (
                  <div key={module.id} className={`bg-white rounded-lg shadow p-6 ${!canAccess ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{module.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{module.questions.length} questions</p>
                        {!canAccess && <p className="text-xs text-red-600 mt-2">Complete previous module first</p>}
                      </div>
                      {isCompleted && (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      )}
                      {!canAccess && (
                        <Lock className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <button
                      onClick={() => handleStartModule(module.id)}
                      disabled={!canAccess}
                      className={`w-full py-2 rounded-lg transition font-medium ${
                        canAccess
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      {isCompleted ? 'Review Module' : 'Start Module'}
                    </button>
                  </div>
                )
              })}
            </div>

            {progress?.completed_modules?.length === volumeData[currentVolume].modules.length && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                <Award className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">All Modules Complete!</h3>
                <p className="text-gray-600 mb-6">You've completed all modules. Take the final certification exam to earn your certificate.</p>
                <button
                  onClick={handleStartFinalExam}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Take Final Exam (50 questions, 85% to pass)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Module Content */}
        {screen === 'module-content' && currentVolume && (
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setScreen('modules')}
              className="text-blue-600 hover:text-blue-700 font-medium mb-6"
            >
              ← Back to Modules
            </button>

            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {volumeData[currentVolume].modules[currentModule - 1]?.title}
              </h2>

              {/* Video Player Section */}
              {moduleVideos.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Play className="w-5 h-5 text-blue-600" />
                      Video {currentVideoIdx + 1} of {moduleVideos.length}
                      {moduleVideos[currentVideoIdx]?.title_en && (
                        <span className="text-gray-500 font-normal text-sm">
                          — {moduleVideos[currentVideoIdx].title_en}
                        </span>
                      )}
                    </h3>
                    {allVideosWatched && (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" /> All videos watched
                      </span>
                    )}
                  </div>

                  {videoLoading ? (
                    <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p>Loading video...</p>
                      </div>
                    </div>
                  ) : signedVideoUrl ? (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <video
                        key={signedVideoUrl}
                        src={signedVideoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-gray-500 text-center">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                        <p>Video not yet available</p>
                      </div>
                    </div>
                  )}

                  {/* Next Video button */}
                  {!allVideosWatched && moduleVideos.length > 1 && (
                    <button
                      onClick={handleNextVideo}
                      className="mt-3 px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition font-medium text-sm"
                    >
                      {currentVideoIdx < moduleVideos.length - 1
                        ? `Next Video (${currentVideoIdx + 2} of ${moduleVideos.length})`
                        : 'Mark All Videos Watched'}
                    </button>
                  )}
                </div>
              )}

              {/* Module Text Content */}
              <div className="prose prose-sm max-w-none mb-8 max-h-96 overflow-y-auto">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {volumeData[currentVolume].modules[currentModule - 1]?.content}
                </div>
              </div>

              <button
                onClick={handleContentComplete}
                disabled={moduleVideos.length > 0 && !allVideosWatched}
                className={`w-full py-3 rounded-lg transition font-medium ${
                  moduleVideos.length > 0 && !allVideosWatched
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {moduleVideos.length > 0 && !allVideosWatched
                  ? 'Watch all videos to continue'
                  : 'Complete & Take Module Test'}
              </button>
            </div>
          </div>
        )}

        {/* Module Test */}
        {screen === 'module-test' && currentVolume && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {volumeData[currentVolume].modules[currentModule - 1]?.title} - Test
              </h2>

              <div className="space-y-8">
                {volumeData[currentVolume].modules[currentModule - 1]?.questions.map((question, idx) => (
                  <div key={question.id} className="border-b pb-6 last:border-b-0">
                    <p className="font-medium text-gray-900 mb-4">
                      {idx + 1}. {question.question}
                    </p>
                    <div className="space-y-2">
                      {question.options.map((option, optIdx) => (
                        <label key={optIdx} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="radio"
                            name={question.id}
                            value={optIdx}
                            checked={testAnswers[question.id] === optIdx}
                            onChange={() => handleTestAnswer(question.id, optIdx)}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {showAlert && (
                <div className="my-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-green-800 font-medium">{alertMessage}</span>
                  </div>
                  <button
                    onClick={() => setShowAlert(false)}
                    className="text-green-600 hover:text-green-700 font-medium text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <button
                onClick={handleSubmitModuleTest}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-medium mt-8"
              >
                Submit Test
              </button>
            </div>
          </div>
        )}

        {/* Final Exam */}
        {screen === 'final-exam' && currentVolume && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                HartFelt Ready™ Volume 1 - Final Certification Exam
              </h2>
              <p className="text-gray-600 mb-8">50 Questions | 85% Required to Pass</p>

              <div className="space-y-8">
                {volumeData[currentVolume].finalExam.map((question, idx) => (
                  <div key={question.id} className="border-b pb-6 last:border-b-0">
                    <p className="font-medium text-gray-900 mb-4">
                      {idx + 1}. {question.question}
                    </p>
                    <div className="space-y-2">
                      {question.options.map((option, optIdx) => (
                        <label key={optIdx} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="radio"
                            name={question.id}
                            value={optIdx}
                            checked={testAnswers[question.id] === optIdx}
                            onChange={() => handleTestAnswer(question.id, optIdx)}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {showAlert && (
                <div className="my-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-green-800 font-medium">{alertMessage}</span>
                  </div>
                  <button
                    onClick={() => setShowAlert(false)}
                    className="text-green-600 hover:text-green-700 font-medium text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <button
                onClick={handleSubmitFinalExam}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-medium mt-8"
              >
                Submit Final Exam
              </button>
            </div>
          </div>
        )}

        {/* Certificate */}
        {screen === 'certificate' && certificateData && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow p-12 text-center border-4 border-blue-600">
              <img src="/logo.png" alt="HartFelt" className="w-20 h-20 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-blue-600 mb-2">HartFelt Ready™</h1>
              <p className="text-lg text-gray-600 mb-8">Certification of Completion</p>

              <div className="border-t border-b py-8 mb-8">
                <p className="text-gray-600 mb-2">This certifies that</p>
                <p className="text-2xl font-bold text-gray-900 mb-4">{certificateData.name}</p>
                <p className="text-gray-600">Has successfully completed Volume 1 of the HartFelt Ready™ Training Program</p>
                <p className="text-gray-600 mt-4">with a final exam score of <span className="font-bold">{certificateData.score}%</span></p>
              </div>

              <p className="text-gray-600 text-sm mb-8">Awarded on {certificateData.date}</p>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 text-white px-8 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Print Certificate
                </button>
                <button
                  onClick={() => {
                    setScreen('volumes')
                    setCurrentVolume(null)
                    setCertificateData(null)
                  }}
                  className="bg-gray-200 text-gray-700 px-8 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Back to Volumes
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
