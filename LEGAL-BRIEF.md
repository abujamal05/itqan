# Legal brief — what the Privacy Policy and Terms have to address

**This is not legal advice and not draft legal text.** It is the issue list for whoever drafts the
real thing: what the obligation is, why Itqan specifically triggers it, and what has to be decided
or found out first. `itqan-website/CLAUDE.md` locks the rule that no legal text is written here, and
this document does not break it. It is the brief that rule says should exist.

Produced 2026-08-24 through `tools/itqan_content_mcp.py` with Gemini in a legal-analyst role, over
researched sources rather than recall, and reviewed against those sources before landing here. The
first pass dropped six of the obligations it was given; this is the second.

## Why this is urgent rather than housekeeping

**Oman's Personal Data Protection Law has been fully enforceable since 5 February 2026.** The
transition period is over. Itqan currently ships a Privacy Policy and Terms that describe practice
and state plainly that the binding version is being drafted, which is honest but is not a privacy
notice under Article 14. Article 14 requires a written notice to the data subject **before**
processing begins, and the fine for failing to give proper notice runs 500 to 2,000 OMR per offence.

That is the smallest number on this page. The two that are not small:

| Failure | Fine |
|---|---|
| Unlawful cross-border transfer (Art. 23) | **100,000 to 500,000 OMR** |
| Processing sensitive data without an MTCIT permit | **20,000 to 100,000 OMR** |
| Mishandling sensitive or children's data, no breach response, or no DPO | 15,000 to 20,000 OMR |
| Breach of Arts. 15 to 18, 20, 22 | 1,000 to 5,000 OMR |
| No proper notice before collecting | 500 to 2,000 OMR |

Regulator is the Ministry of Transport, Communications and Information Technology (MTCIT).

## The two questions that decide most of this

Neither can be answered from the front end, and both belong to whoever runs the pipeline:

1. **Does the consent cover the transfer abroad, and does each vendor agreement meet Article 38?**
   The agents almost certainly run outside Oman, and that is fine: Executive Regulations Article 37
   makes the data subject's express consent sufficient, with no MTCIT pre-approval. What is not fine
   is consent that never mentions the transfer, which is what Itqan has today. See below.
2. **Is the recorded consent demonstrable, and does it survive the policy being rewritten?** The
   timing itself is already right, and this was checked rather than assumed — see below.

Both are on the list of things to ask the backend team.

## Consent is captured at sign up, and the timing is correct

Worth stating clearly, because an earlier draft of this brief got it wrong. `SignupPage.astro:107`
renders a **required, unticked** checkbox that blocks account creation: *"I agree to Itqan processing
my academic record and my data as described in the privacy policy"*, linking to `/privacy/`, with
`Consent is required before the account can be created.` as its error. It is affirmative, specific,
electronic, not pre-ticked, and it happens **before any document is uploaded**.

That is a strong position against Executive Regulations Article 4 and against Article 14's
before-processing requirement. Two things still have to be true for it to hold:

- **It has to be recorded.** A checkbox proves the user was asked. Persisting the consent flag with a
  timestamp and the version of the policy shown is what proves they answered. The field posts as
  `consent`; whether the server stores it is unknown.
- **It will have to be re-obtained when the policy changes.** Today's checkbox consents to a page
  that says the formal notice is still being written. When the lawyer's version replaces it, that is
  materially different text and prior consent does not carry over to it. **Deferred 2026-08-24:** not
  worth building a re-consent path before the real notice exists. Revisit when the lawyer delivers,
  and note it is only a live problem for accounts created before that date.

---

# Privacy

## Cross-border data transfers
**High risk if done wrong. 100,000 to 500,000 OMR. Cheap to do right.**

**The transfer is not the problem.** An earlier version of this brief implied Itqan needed to keep
processing inside Oman. It does not, and almost nothing in the region could operate under that
reading. Article 23 permits transfer abroad subject to the controls in the Regulations, and prohibits
it only where the transfer could harm the data subject or where the data would be processed in breach
of the PDPL.

**Executive Regulations Article 37: the data subject's express consent is sufficient.** No prior
MTCIT approval is required, provided the transfer does not prejudice national security or the higher
interests of the country. Transfer of genuinely anonymised data needs no consent at all.

**Executive Regulations Article 38: the controller stays responsible for the receiving end.** Itqan
must ensure any processor outside Oman affords protection **not less than** the PDPL and its
Regulations require. Signing a vendor's standard terms and hoping is not that.

So the compliance path is three things, none of which is infrastructure:

1. **Express consent that actually mentions the transfer.** This is the gap. Today's checkbox reads
   *"I agree to Itqan processing my academic record and my data as described in the privacy policy"*.
   It never says the data leaves Oman. Article 37 wants express consent **to the transfer**, so the
   consent as worded probably does not carry it. Fixing this is a string and a sentence in the
   notice, not a migration. **The wording is legally operative and must come from the lawyer**, not
   from this repo.
2. **Name the destinations and the vendors in the privacy notice**, so the consent is informed rather
   than nominal.
3. **A DPA with each vendor that meets the Article 38 standard**, including whether they may train on
   submitted data.

**Unknown, must be answered:** Which vendors, in which regions, under what agreement. The regions
matter less than the agreement now, but the notice has to name both.

## Sensitive data and the permit requirement
**High risk. 20,000 to 100,000 OMR.**
**Obligation:** A controller processing sensitive personal data needs an MTCIT permit **in advance**.
Sensitive data covers finances, sex life, politics, religion, health, genetic and biometric data,
and information about the data subject's personal life.
**Why Itqan triggers it:** Gulf CVs routinely carry a photograph, nationality, marital status, date
of birth and sometimes religion. Itqan never asks for any of it; it arrives inside the document and
the parsing agent reads it. Not asking is not a defence.
**This is a separate obligation from the transfer rules and Article 37 consent does not answer it.**
Consent legitimises sending data abroad. It does not substitute for the permit that processing
sensitive data requires in the first place.

**Dropping sensitive fields at the parsing stage now solves two problems, not one.** It was already
the cleaner answer to the permit question. Executive Regulations Article 37 also exempts genuinely
anonymised data from the cross-border consent requirement, so a parser that discards religion,
marital status, photograph and date of birth before anything is stored or transmitted reduces the
exposure under Article 23 as well. That makes it the strongest single technical change available
here, and it belongs to the pipeline rather than to either front end.

**Unknown, must be answered:** Has a permit been sought? Can the parser drop these fields before
storage and before transmission, and can that be evidenced? If it can, the privacy notice should say
so, because it is a claim worth making and one of the few here that a skeptical user can check.

## Duty to appoint a Data Protection Officer
**Medium-high risk. 15,000 to 20,000 OMR.**
**Obligation:** Certain controllers must appoint a DPO to oversee compliance and act as the MTCIT's
point of contact.
**Why Itqan triggers it:** Large-scale processing of personal data for profiling, over high-value
academic and professional records.
**Decided 2026-08-24: deferred to launch.** The lead's call, and defensible while Itqan is
pre-launch with no real users being processed. One thing to get right when it happens: the
obligation attaches to the processing, not to the launch announcement, so the appointment has to be
**in place on day one** rather than started on day one. A lawyer still has to read the Executive
Regulations threshold to confirm Itqan's volume triggers the mandatory appointment at all.

## Breach response and reporting
**Medium-high risk. 15,000 to 20,000 OMR.**
**Obligation:** A protocol for identifying and responding to breaches, including notifying the
regulator and the data subject in defined circumstances.
**Why Itqan triggers it:** Itqan holds dense personal identifiers, including transcripts and phone
photographs of identity-bearing documents.
**Must be decided:** The internal incident response timeline, and the notification window stated in
the notice.

## Retention and deletion
**Medium risk. Up to 20,000 OMR.**
**Obligation:** The right to request deletion at any time.
**Why Itqan triggers it:** Itqan stores both the original files and the extracted skills profile
derived from them. If the two are not purged together, the deletion is incomplete.
**Sector precedent:** A 2024 audit of 12 resume builders found 9 retained uploaded content for 30 to
180 days after account deletion, and 2 kept it indefinitely.
**Unknown, must be answered:** The retention period. Whether deletion reaches backups and third-party
vendor logs. If anonymised data is kept for model improvement, whether it is genuinely beyond
re-identification.

## Naming sub-processors, and whether they train on the data
**Medium risk.**
**Obligation:** Regulators expect sub-processors to be named, and expect the policy to state whether
a vendor may use the data for its own training.
**Why Itqan triggers it:** Itqan depends on model vendors to function. Users have a right to know
whether their professional history trains someone else's model.
**Known drafting failure to avoid:** policies that permit "anonymised or aggregated" resume data to
improve AI models. That wording blurs training and profiling and is exactly what regulators pull on.
**Unknown, must be answered:** Which vendors, and what do their terms allow?

## Automated profiling and the right to human review
**Medium risk.**
**Obligation:** Users must be told how their data is processed. For users in scope of GDPR, a right
not to be subject to a decision based solely on automated processing with legal or similarly
significant effects, and a right to request human review.
**Why Itqan triggers it:** Four sequential agents match a person against live postings and recommend
roles. That is automated profiling. The confirmation screen is a genuine defence but the process
downstream of it remains automated.
**Sector precedent:** a recruitment agency fined 400,000 EUR for AI candidate profiling without
valid consent.
**Must be decided:** Does any human at Itqan ever review a match, or is the user the only human in
the loop? Is the confirmation screen sufficient to satisfy the right to human review?

## Notice and consent timing
**Medium risk. 500 to 2,000 OMR.**
**Obligation:** Article 14 requires a written privacy notice before processing begins. Valid consent
under Executive Regulations Article 4 is given by a person of full capacity, clearly and without
coercion, in writing or electronically. Separate written consent is required before any commercial
marketing.
**Why Itqan triggers it:** Consent is taken at sign up, before upload, which is the right point.
The remaining exposure is not the timing but the record: consent that cannot be evidenced is
consent that did not happen, and consent to a placeholder page does not carry over to the binding
notice that replaces it.
**Must be decided:** Whether the server persists the `consent` field with a timestamp and a policy
version, how re-consent is obtained when the notice is published, and whether marketing consent is
a separate checkbox from service consent. It must be separate.

## Withdrawal of consent
**Medium risk.**
**Obligation:** Consent can be withdrawn at any time, and processing must then stop.
**Why Itqan triggers it:** Itqan maintains an ongoing profile, a pathway and a match history.
**Must be decided:** What happens to the derived profile, pathway and match history on withdrawal.
Whether withdrawal triggers deletion of derived data or only stops further processing.

## Data portability
**Lower risk, still a right.**
**Obligation:** Data in a structured, commonly used, machine-readable format.
**Why Itqan triggers it:** Users invest real effort building a profile and pathway.
**Must be decided:** Whether portability covers only the uploaded documents or also the
Itqan-generated skills profile and pathway.

## Capacity and minors
**Lower risk, with a sharp edge.**
**Obligation:** Valid consent requires full capacity. Separate fines apply to mishandling children's
data.
**Why Itqan triggers it:** The graduate audience includes people near the age of majority.
**Must be decided:** A minimum age, a capacity declaration in the consent flow, and what happens if
a minor signs up.

---

# Terms

## Accuracy, and liability for matching outcomes
**High risk.**
**Obligation:** Define the limit of the service, so no user can claim a contract for employment
exists or that the output was professional advice to rely on.
**Why Itqan triggers it:** Itqan recommends specific postings and pathways from AI extraction with
**no measured accuracy figure**, and errors in the first agent compound through the next three. Four
stages at 90% is roughly 73% end to end.
**Must be decided:** That the user is responsible for confirming extracted skills at the confirmation
screen before matching. This is already how the product behaves; the Terms have to say it.
**Standing product rule:** Itqan never promises a job. The Terms must not imply one either.

## Payment and currency conversion
**Medium risk.**
**Obligation:** State the price and the nature of the transaction clearly.
**Why Itqan triggers it:** Itqan displays 2.9 OMR and executes 7.50 USD through a third-party
processor, because the processor does not support the rial.
**Must be decided:** Who bears conversion fees and fluctuation. That Itqan does not store card
details. Renewal, cancellation and the "access until period end" rule.

## User content and intellectual property
**Medium risk.**
**Obligation:** Define who owns the uploaded documents and the generated output.
**Why Itqan triggers it:** Itqan derives a new dataset — a skills profile and a pathway — from
documents the user did not always author. A transcript is issued by a university, not by the student.
**Must be decided:** That the user retains ownership and grants Itqan a licence to process for the
service. Whether the generated pathway and profile are Itqan's intellectual property.

---

## What is still missing, and cannot be written without it

Every item marked unknown above resolves to one of these. None can be answered from the front end.

- Where the servers are, and where the four agents run.
- Which model vendors are used, and whether their terms permit training on submitted data.
- Whether a Data Processing Agreement exists with each.
- Retention periods, and whether deletion reaches backups and vendor logs.
- Whether an MTCIT permit has been sought for sensitive data.
- Whether the sign-up `consent` field is persisted, with a timestamp and a policy version.

## Sources

- [Overview of Oman's PDPL — Securiti](https://securiti.ai/oman-personal-data-protection-law-pdpl/)
- [Oman PDPL: entering the enforcement phase — CMS](https://cms.law/en/omn/legal-updates/oman-personal-data-protection-law-entering-the-enforcement-phase)
- [Royal Decree 6/2022 — decree.om](https://decree.om/2022/rd20220006/)
- [Executive Regulations to Oman's Data Protection Law — Amjoman](https://www.amjoman.com/executive-regulations-to-the-omans-data-protection-law/)
- [Oman PDPL 2026: requirements and compliance roadmap — Kooch](https://kooch.co/en/post/oman-personal-data-protection-law-pdpl-compliance-2026)
- [Executive Regulations, what you should know — Addleshaw Goddard](https://www.addleshawgoddard.com/en/insights/insights-briefings/2024/data-protection/executive-regulations-oman-personal-data-protection-law/)
- [Oman's data protection law, new regulations — Trowers & Hamlins](https://www.trowers.com/insights/2024/february/omans-data-protection-law---new-regulations)
- [Guide to Oman's PDPL — Privacy Bee](https://business.privacybee.com/resource-center/guide-to-omans-personal-data-protection-law-pdpl/)
- [When AI decision-making violates data privacy and consent — CookieHub](https://www.cookiehub.com/blog/when-automated-ai-decision-making-violates-data-privacy-and-consent-rules)
- [How to create an AI privacy policy — Usercentrics](https://usercentrics.com/guides/privacy-policy/ai-privacy-policy/)
- [GDPR meets AI: consent in candidate data mining — IT Recruitment Academy](https://itrecruitmentacademy.com/post/gdpr-meets-ai-navigating-consent-in-candidate-data-mining)
