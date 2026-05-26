export type HelpCardId =
  | 'welcome'
  | 'metronome'
  | 'tuner'
  | 'songs'
  | 'exercises'
  | 'charts'
  | 'feedback'

export interface HelpGestureHint {
  label: string
  detail: string
}

export interface HelpCardContent {
  id: HelpCardId
  eyebrow: string
  headline: string
  body: string
  gestures?: HelpGestureHint[]
  email?: string
}

export const HELP_CARDS: HelpCardContent[] = [
  {
    id: 'welcome',
    eyebrow: 'Quick tour',
    headline: 'Everything you need to practice',
    body: 'Swipe through a few tips. You can reopen this anytime from home.',
  },
  {
    id: 'metronome',
    eyebrow: 'Always on',
    headline: "Metronome's always there",
    body: 'The beat follows you on every screen. Tap to start or stop.',
    gestures: [
      { label: 'Tap', detail: 'Start or stop' },
      { label: 'Long press', detail: 'BPM, time signature, tap tempo' },
    ],
  },
  {
    id: 'tuner',
    eyebrow: 'Before you play',
    headline: 'Tune up first',
    body: 'Open the tuner from home. Pluck a string and follow the needle until you’re in tune.',
  },
  {
    id: 'songs',
    eyebrow: 'Practice along',
    headline: 'Learn at your speed',
    body: 'Download a song offline, slow the track without changing pitch, then record yourself playing along.',
    gestures: [
      { label: 'Download', detail: 'Offline playback' },
      { label: 'Slow down', detail: '0.4× – 1.25×' },
      { label: 'Record', detail: 'Capture your take' },
    ],
  },
  {
    id: 'exercises',
    eyebrow: 'Warm up',
    headline: 'Build speed on drills',
    body: 'Add finger exercises and track tempo over time. Start the metronome on an exercise to log your BPM.',
  },
  {
    id: 'charts',
    eyebrow: 'Your cheat sheet',
    headline: 'Charts and notes stay with the song',
    body: 'Upload a chord chart PDF or image. Jot practice notes on the song so you remember what to fix next time.',
  },
  {
    id: 'feedback',
    eyebrow: 'Hear from you',
    headline: 'Ideas, bugs, or “this saved my solo”',
    body: 'Email feedback, feature requests, or issues — we read everything.',
    email: 'sgshubham@gmail.com',
  },
]
