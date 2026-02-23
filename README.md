# Protein Tracker

A mobile-first macro tracking web app built with Angular and Supabase. Track your protein, carbs, and fat intake with friends in shared groups.

## Features

- **Auth**: Email magic link authentication
- **Groups**: Create or join groups to track macros together
- **Library**: Manage ingredients and meals
- **Today**: Fast logging with favorites, quick add, and repeat last
- **Dashboard**: View group progress and weekly summaries
- **PWA**: Installable on mobile devices

## Tech Stack

- Angular 18 (standalone components)
- Supabase (Auth + Postgres)
- TypeScript
- SCSS
- PWA-ready

## Local Development

1. Clone the repo
2. Install dependencies: `npm install`
3. Set up Supabase (see below)
4. Update environment files with your Supabase credentials
5. Run: `npm start`

## Supabase Setup

1. Create a new Supabase project
2. Run the SQL in `supabase/schema.sql` to create tables
3. Run the SQL in `supabase/policies.sql` to set up RLS policies
4. Update auth redirect URLs to include your domain
5. Copy your project URL and anon key to `src/environments/environment.ts`

## Deployment to GitHub Pages

1. Push to GitHub main branch
2. Enable GitHub Pages in repository settings (deploy from gh-pages branch)
3. The GitHub Actions workflow will automatically build and deploy on push

## Usage

1. Sign up with email
2. Create or join a group
3. Add ingredients/meals to your library
4. Log food intake on the Today screen
5. View group progress on the Dashboard

## MVP Limitations

- Invite codes are group IDs (not secure tokens)
- Meal macro calculation is simplified
- No advanced search or filtering
- Basic UI without full theming

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
