# Legal brief — what the Privacy Policy and Terms have to address

**This is not legal advice.** It is the obligation list behind Itqan's legal pages: what each duty is,
why Itqan triggers it, what was verified against the running system, and what is still open.

**Status changed 2026-08-24.** `/privacy` and `/terms` are no longer placeholders. Both are written in
full, in both locales, on the lead's instruction, and go to a lawyer to **review and amend** rather
than to author from nothing. This document is what that lawyer should read first, and it is also the
list of things that must stay true for the published text to keep being true.

**Three sentences in the published policy are promises the organisation has not finished keeping.**
They are stated as fact on a live page, so they are commitments now, not intentions:

1. `privacy@tryitqan.com` and `support@tryitqan.com` are given as the way to exercise every right in
   the policy. **Neither mailbox exists yet.** Nothing else on this page matters more, because a right
   with an address nobody reads is worse than no address.
2. Account erasure "on request" is promised. There is still no route, and it is done by hand.
3. Erased data is said to leave backups "as the rotation completes". That rotation period has not been
   decided or written down.

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

- **It has to be recorded — and until 2026-08-24 it was not.** `POST /api/auth/signup` bound email,
  password and name; the `consent` field was posted by the form and **silently dropped**. Nothing was
  stored. Every account created before the fix has a consent that cannot be evidenced.

  Now being closed at both ends. Server side: an `app_consents` table keyed on user and `kind`, so
  **marketing consent is a separate row the sign-up box can never satisfy** and an absent row is a
  clean, auditable no. Signup refuses without consent, because the required attribute on a checkbox
  is a courtesy and not a rule.

  Site side, and **already shipped**: the form posts `policy_version`, sourced from
  `privacyPolicyVersion` in `itqan-website/src/config.ts`, currently
  `2026-08-24-placeholder`. **The renderer sends it rather than the server stamping its own idea of
  "current"**, because the site is static and the HTML a visitor has open was built in the past. A
  server guessing gets it wrong precisely when it matters, which is when a cached older policy is the
  one being read. **Bump that constant whenever the policy text changes.**
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

### Answered 2026-08-24 — the vendors and where the data goes

From the API team, verified against the running system rather than recalled.

| Vendor | Receives | Where |
|---|---|---|
| **OVH** | **All storage — Postgres and every uploaded file** | **Singapore** |
| OpenAI | CV and transcript **text**, chat messages, job and course text, embeddings | US |
| Brevo | Email address, name, verification codes | EU |
| Paddle | Email, payment details | Their infrastructure |
| Apify | LinkedIn **job postings only**. No user personal data | — |
| OpenRouter | Nothing. `api_base` is empty and the path is inert | — |

**The storage location is the finding, not the AI.** Every uploaded CV and the whole database sit in
Singapore. That is a cross-border transfer of everything, continuously, and it is a larger surface
than the model calls the earlier drafts of this brief worried about. It is still permitted on the
Article 37 consent basis, and it still has to be named in the notice.

**OpenAI does not train on it.** Their published policy, quotable: *"data sent to the OpenAI API is
not used to train or improve OpenAI models (unless you explicitly opt in)"*, since 1 March 2023.
Abuse-monitoring logs are kept up to 30 days. **Zero Data Retention removes even those**, subject to
OpenAI's prior approval — worth applying for, and someone has to actually ask.

**Still unanswered:** whether a signed DPA exists with each vendor meeting the Article 38 standard.
The published policy is a promise to the world; a DPA is a promise to Itqan, and Article 38 asks for
the second.

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

### Answered 2026-08-24 — and the answer is much better than this brief assumed

Established from the code, not from recollection. Three of the four worries here were already
handled by the design:

- **The extraction schemas cannot represent these categories at all.** `CVExtraction` holds name,
  contact, skills, education, experience, projects, certifications, courses. `ContactInfo` is email,
  phone, location, LinkedIn, GitHub. `TranscriptExtraction` is name, institution, programme, CGPA,
  courses. Religion, marital status, nationality, gender, photograph and date of birth are
  **structurally unrepresentable**, not merely un-asked-for.
- **No image is ever sent to a model.** There is no vision call anywhere in Agent A — no
  `image_url`, no base64. Text comes from PyMuPDF's text layer or from PaddleOCR, which runs
  **locally in Itqan's own container**. The photograph on a Gulf CV never leaves the server.
- **The written summary cannot smuggle them in.** `build_input_profile` composes the summariser's
  input from the structured extraction and the grounding report, never from raw document text.

**What IS transmitted, and the notice must say so.** The extracted document **text** goes to OpenAI,
because that is the extraction step. If a CV states a religion, that sentence is in the text sent. It
is not stored in any field and reaches no summary, but it is transmitted, and a notice that implies
otherwise would be false.

**Redaction before transmission was considered and rejected, correctly.** It would have to run before
anything understands the text, in Arabic and English, and a false positive silently deletes a real
qualification. This product has already paid for that exact shape once: a span check dropped all 24
skills from a real CV, every one of which had matched the document verbatim.

**Still unanswered:** whether an MTCIT permit has been sought. The transmitted-text point above means
the question has not gone away entirely, even though the storage side is clean.

**Being pinned, not just claimed.** These properties are currently true by accident of design, and
the notice will turn them into promises. The API team is adding three tests — the schema stays
closed, no image reaches a model, and the summariser never sees raw text — so that adding a
`nationality` field means confronting a test that explains the 20,000 to 100,000 OMR reason it
exists. That is what makes the claim checkable, which is the only kind worth publishing.

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
### Answered 2026-08-24 — this is now the largest open item on the page

**There is no account deletion. No route, no store method, nothing.** This brief asked whether
deletion reached backups; the question assumed a thing that does not exist. **A user cannot exercise
the right to erasure at all.** The only account deletion this system has ever performed was
hand-written SQL on the VPS.

Three related facts the drafter needs:

- **No automatic retention limit** on uploaded documents or derived profiles. Both persist until
  something deletes them, and nothing does.
- **There is an OVH snapshot backup**, which is one copy any future deletion will not reach without
  a stated snapshot-rotation period. That period has to be decided and then written down.
- **`DELETE /api/documents/:id` is complete today** — it removes the row and unlinks the file. So
  per-document deletion works. It is account-level erasure that is missing, and that route is the
  model the eventual erasure should follow.

**Decided 2026-08-24: erasure is planned as separate work.** It is irreversible, touches every
table, and deserves its own review rather than riding along with a documentation change. The right
call. **What must not happen in the meantime is a privacy notice that describes a deletion right
users do not have** — that converts a missing feature into a false statement in a legal document.
Until the route exists, the notice says how to ask a human, or it says nothing.

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
**Why Itqan triggers it:** Itqan displays 2.9 OMR and executes 7.54 USD through a third-party
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

## What is still missing, after the 2026-08-24 answers

Most of this list is now closed. What remains needs a **person**, not a code search, which is
exactly why it has not been answered by looking:

1. **Signed DPAs** with OVH, OpenAI, Brevo and Paddle, meeting the Article 38 standard. A published
   policy is a promise to the world; Article 38 asks for a promise to Itqan.
2. **The MTCIT permit** for sensitive data. Still not sought as far as anyone has said, and the
   transmitted-text finding means the question is live even though storage is clean.
3. **The incident response procedure.** Nothing in the code can answer this and nothing in the
   repository contains one. Handed back as a question rather than guessed at.
4. **The OVH snapshot rotation period**, which bounds how long a deletion takes to become true.
5. **Zero Data Retention with OpenAI** — available, subject to their prior approval. Somebody has to
   apply.

Closed since the first version of this brief: vendor list and destinations, training terms, the
sensitive-field guarantees, consent recording, and the consent-timing question.

## The rule that governs how any of this gets written up

**The most dangerous sentence available here is "yes, we do that" about a control nobody has
verified.** A privacy notice states things to users and to a regulator, so anything overstated
becomes a false claim in a legal document, and the failure mode is worse than saying nothing.

Two guards, both already in force above. Everything in this brief is drawn either from code or from
a vendor's published policy, and says which. The questions only a person can answer are handed back
as questions rather than filled in with plausible answers.

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
