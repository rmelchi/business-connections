# Business Connections

Create a polished MVP for a private B2B member matchmaking web application. Working name: Business Match. It will later integrate with WildApricot, which must remain the authoritative source for member identity and membership status. For this first build, create the full UI and data-ready application structure, with a clean professional chamber-of-commerce/business-network aesthetic.

Core user experience:
1. Login screen for members.
2. Member dashboard showing strongest matches, active requests, active offers, and clear Add Offer / Add Request actions.
3. Profile page with name, company, title, industry, geography, short bio and membership status. Include a read-only WildApricot Contact ID field and indicate profile identity data is synchronized from WildApricot.
4. Offers: members can create multiple independent offers. Fields: title, detailed description, category, industry, geography, product/service, B2B/B2C, keywords, active/inactive, created/updated timestamps.
5. Requests: members can create multiple independent requests with the same structured fields, plus an optional expiration date.
6. Matches page: compare REQUESTS against other members' OFFERS, display match score, why the match exists, relevant request/offer excerpts, company/person, geography, and Interested / Not Relevant actions.
7. Highlight reciprocal matches where Member A's request matches Member B's offer AND Member B's request matches Member A's offer. Label these prominently as Mutual Opportunity.
8. Match detail page with a clear explanation and an 'I'm Interested' action. Contact details can be shown as protected/hidden until mutual interest.
9. Notifications area for newly discovered strong matches.
10. Admin dashboard showing members, active/inactive membership status, offers, requests, matches, and basic statistics.

Matching architecture to prepare for: semantic embeddings plus structured scoring. Conceptual initial weighting: semantic similarity 60%, industry/category compatibility 15%, geography 10%, structured criteria 10%, recency 5%, with a reciprocal-match bonus. Do not fake a production AI backend yet, but structure the code/data model so a semantic matching service can be added cleanly.

WildApricot integration architecture: use wildapricot_contact_id as the external identity link. WildApricot owns name, email, company, membership level/status, phone and basic membership data. This app owns offers, requests, embeddings, matches, match explanations, interest status and matching history. Prepare a service/integration layer for future WildApricot REST API and webhook synchronization. A lapsed/inactive WildApricot member should be representable as disabled for matching without deleting their offers/requests.

Create realistic sample/demo data so the dashboard is meaningful. Use examples such as an Italian specialty-food producer seeking a California distributor and a California importer/distributor seeking Italian producers, demonstrating a high-scoring reciprocal match.

Design: premium, modern, trustworthy B2B network; spacious layout, strong typography, restrained visual treatment, desktop-first but fully responsive. Navigation: Dashboard, Matches, Offers, Requests, Profile, Notifications; Admin available for admin role. Avoid generic social-network styling. Make the value proposition obvious: 'Find the right business opportunity within your network.'

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/89f66730-371a-4c70-a5e0-145752554815).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
