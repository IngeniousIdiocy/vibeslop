import { createEventBus, EventBus } from '@core/kernel/eventBus';

export type ScalingMode = 'fit' | 'pixel';

export interface DisplayState {
  width: number;
  height: number;
  scalingMode: ScalingMode;
  integerScale: boolean;
}

export interface DisplayChangeEvent {
  state: DisplayState;
}

export interface DisplayService {
  getState(): DisplayState;
  setResolution(width: number, height: number): void;
  setScalingMode(mode: ScalingMode): void;
  toggleIntegerScale(enabled: boolean): void;
  bus: EventBus;
}

const DEFAULT_STATE: DisplayState = {
  width: 640,
  height: 480,
  scalingMode: 'fit',
  integerScale: true,
};

export function createDisplayService(initial: Partial<DisplayState> = {}): DisplayService {
  let state: DisplayState = { ...DEFAULT_STATE, ...initial };
  const bus = createEventBus();

  function emit() {
    bus.emit<DisplayChangeEvent>('display:changed', { state });
  }

  return {
    bus,
    getState() {
      return state;
    },
    setResolution(width, height) {
      state = { ...state, width, height };
      emit();
    },
    setScalingMode(mode) {
      state = { ...state, scalingMode: mode };
      emit();
    },
    toggleIntegerScale(enabled) {
      state = { ...state, integerScale: enabled };
      emit();
    },
  };
}
