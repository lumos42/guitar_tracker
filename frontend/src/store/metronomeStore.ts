import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clampBpm, effectiveSongBpm } from '@/lib/songMetronome'

type TimeSig = 2 | 3 | 4 | 6

interface ExerciseMetronomeContext {
  bpm: number
  beatsPerBar: TimeSig
}

interface MetronomeState {
  bpm: number
  beatsPerBar: TimeSig
  activeExerciseId: number | null
  activeSongId: number | null
  songBaseBpm: number | null
  exerciseContexts: Record<string, ExerciseMetronomeContext>
  setBpm: (bpm: number) => void
  setBeatsPerBar: (beatsPerBar: TimeSig) => void
  setExerciseContext: (exerciseId: number, defaults: ExerciseMetronomeContext) => void
  setSongContext: (songId: number, baseBpm: number, speed?: number) => void
  setSongPlaybackSpeed: (speed: number) => void
  clearSongContext: () => void
}

const toContextKey = (exerciseId: number) => String(exerciseId)

export const useMetronomeStore = create<MetronomeState>()(
  persist(
    (set, get) => ({
      bpm: 120,
      beatsPerBar: 4,
      activeExerciseId: null,
      activeSongId: null,
      songBaseBpm: null,
      exerciseContexts: {},
      setBpm: (value) => {
        const bpm = clampBpm(value)
        set((state) => {
          if (!state.activeExerciseId) return { bpm }
          const key = toContextKey(state.activeExerciseId)
          return {
            bpm,
            exerciseContexts: {
              ...state.exerciseContexts,
              [key]: { bpm, beatsPerBar: state.beatsPerBar },
            },
          }
        })
      },
      setBeatsPerBar: (beatsPerBar) => {
        set((state) => {
          if (!state.activeExerciseId) return { beatsPerBar }
          const key = toContextKey(state.activeExerciseId)
          return {
            beatsPerBar,
            exerciseContexts: {
              ...state.exerciseContexts,
              [key]: { bpm: state.bpm, beatsPerBar },
            },
          }
        })
      },
      setExerciseContext: (exerciseId, defaults) => {
        const key = toContextKey(exerciseId)
        const existing = get().exerciseContexts[key]
        const context = existing ?? {
          bpm: clampBpm(defaults.bpm),
          beatsPerBar: defaults.beatsPerBar,
        }
        set((state) => ({
          activeExerciseId: exerciseId,
          activeSongId: null,
          songBaseBpm: null,
          bpm: context.bpm,
          beatsPerBar: context.beatsPerBar,
          exerciseContexts: existing
            ? state.exerciseContexts
            : { ...state.exerciseContexts, [key]: context },
        }))
      },
      setSongContext: (songId, baseBpm, speed = 1) => {
        set({
          activeSongId: songId,
          activeExerciseId: null,
          songBaseBpm: baseBpm,
          bpm: effectiveSongBpm(baseBpm, speed),
        })
      },
      setSongPlaybackSpeed: (speed) => {
        const { activeSongId, songBaseBpm } = get()
        if (!activeSongId || songBaseBpm == null) return
        set({ bpm: effectiveSongBpm(songBaseBpm, speed) })
      },
      clearSongContext: () => {
        set({ activeSongId: null, songBaseBpm: null })
      },
    }),
    {
      name: 'guitar-tracker-metronome',
      partialize: (state) => ({
        bpm: state.bpm,
        beatsPerBar: state.beatsPerBar,
        activeExerciseId: state.activeExerciseId,
        exerciseContexts: state.exerciseContexts,
      }),
    }
  )
)
