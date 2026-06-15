# Product Notes

## What Is NevFit?

NevFit is a personal training and health platform that begins as a workout
logger and program manager. It may later expand into progression tracking,
family coaching, endurance tracking, nutrition, and broader health management.

## Current MVP Goal

Replace the user's Built With Science workout logging workflow with a faster,
mobile-first app for planning, starting, logging, and reviewing workouts.

## Core Principles

- Fast logging
- Mobile first
- User-focused
- No unnecessary complexity
- Features must solve real workflow problems
- Opening a workout must never destroy previous effort data

## Implemented Features

- Dashboard default landing screen
- Today-focused workout card with Start/Resume action
- Current Program, Current Cycle, This Week, and Latest Workout dashboard cards
- Weekly schedule persistence
- Program editor
- Custom programs and routines
- Routine duplication, rename, archive, and save feedback
- Workout mode with active workout persistence
- Rest timer with repeated audible alarm, vibration support, and strong complete state
- Append-only completed workout history
- Previous performance derived from completed workout history
- Blank workout sessions are non-destructive and are not saved as completed workouts
- Provider-neutral exercise library search
- Dedicated Add Exercises builder flow that stays open for repeated additions
- Selectable exercise result cards for Add and Swap flows
- Exercise image, muscle, equipment, instruction, and image-credit display where available
- Collapsed routine exercise cards with single-item expanded editing
- Routine-level exercise display name overrides for variants like DB Reverse Lunge
- Manual step entry with 7-day average dashboard metric
- Manual run logging with configurable weekly run target
- Firebase Google sign-in
- Authenticated app gate with signed-out landing screen
- Firestore `users/{uid}` profile document sync
- Settings/About attribution for exercise data and images

## Current Product Direction

NevFit is evolving from a workout logger into a compact workout management
platform.

Users can:

- See what they are doing today
- Schedule workouts
- Create and manage programs and routines
- Build custom training splits
- Search the NevFit exercise library while editing routines
- Add multiple exercises in a focused builder workflow
- Scan routines quickly with compact exercise cards and expand one exercise to edit
- Rename selected exercises inside a routine without changing the underlying exercise ID
- Track workout history
- Review previous performance
- Track manual steps and weekly runs until integrations exist

Future expansion:

- Workout history screen
- Migrate workout/program data from localStorage to Firestore
- Progression tracking
- PR tracking
- Custom exercise creation
- Automatic runs and steps integrations
- Family coaching
- Nutrition and health tracking
