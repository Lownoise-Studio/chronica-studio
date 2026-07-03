import { ChronicaEventBus } from '../engine/compat/event-bus';

describe('ChronicaEventBus', () => {
  test('emit dispatches to registered listeners in order', () => {
    const bus = new ChronicaEventBus();
    const seen: string[] = [];
    bus.on('choice_selected', payload => {
      seen.push(`a:${payload.choice.uid}`);
    });
    bus.on('choice_selected', payload => {
      seen.push(`b:${payload.choice.uid}`);
    });

    bus.emit('choice_selected', {
      choice: { uid: 'c1', label: '', action: '', conditions: [] },
      previousFragment: null,
      resultingFragment: null,
      currentFragment: null,
      previousState: {
        location: '',
        instability: 0,
        reality_layer: 0,
        memory: {},
        variables: {},
        dialogueLineIndex: 0,
      },
      currentState: {
        location: '',
        instability: 0,
        reality_layer: 0,
        memory: {},
        variables: {},
        dialogueLineIndex: 0,
      },
      turnResult: {
        source: 'choice',
        fragment: null,
        previousFragment: null,
        stateChanged: false,
        fragmentChanged: false,
      },
    });

    expect(seen).toEqual(['a:c1', 'b:c1']);
  });

  test('on returns unsubscribe closure', () => {
    const bus = new ChronicaEventBus();
    const listener = jest.fn();
    const off = bus.on('session_reset', listener);
    off();
    bus.emit('session_reset', {});
    expect(listener).not.toHaveBeenCalled();
  });

  test('off removes a specific listener', () => {
    const bus = new ChronicaEventBus();
    const keep = jest.fn();
    const drop = jest.fn();
    bus.on('session_reset', keep);
    bus.on('session_reset', drop);
    bus.off('session_reset', drop);

    bus.emit('session_reset', {});
    expect(keep).toHaveBeenCalledTimes(1);
    expect(drop).not.toHaveBeenCalled();
  });

  test('off is a no-op when the listener is unknown', () => {
    const bus = new ChronicaEventBus();
    const stray = jest.fn();
    expect(() => bus.off('session_reset', stray)).not.toThrow();
  });

  test('once fires exactly one time', () => {
    const bus = new ChronicaEventBus();
    const listener = jest.fn();
    bus.once('session_reset', listener);
    bus.emit('session_reset', {});
    bus.emit('session_reset', {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('unsubscribing during emit does not skip peers', () => {
    const bus = new ChronicaEventBus();
    const calls: string[] = [];
    const offA = bus.on('session_reset', () => {
      calls.push('a');
      offA();
    });
    bus.on('session_reset', () => calls.push('b'));

    bus.emit('session_reset', {});
    expect(calls).toEqual(['a', 'b']);
  });

  test('listener errors do not stop the loop and are forwarded', () => {
    const bus = new ChronicaEventBus();
    const errors: unknown[] = [];
    bus.onListenerError = (_event, err) => errors.push(err);

    bus.on('session_reset', () => { throw new Error('boom'); });
    const survivor = jest.fn();
    bus.on('session_reset', survivor);

    bus.emit('session_reset', {});
    expect(survivor).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
  });

  test('listenerCount tracks additions and removals', () => {
    const bus = new ChronicaEventBus();
    expect(bus.listenerCount('session_started')).toBe(0);
    const off = bus.on('session_started', () => {});
    expect(bus.listenerCount('session_started')).toBe(1);
    off();
    expect(bus.listenerCount('session_started')).toBe(0);
  });

  test('emitModuleError uses the module_error channel', () => {
    const bus = new ChronicaEventBus();
    const listener = jest.fn();
    bus.on('module_error', listener);
    const error = new Error('nope');
    bus.emitModuleError({ moduleId: 'm', hook: 'onSessionStart', error });
    expect(listener).toHaveBeenCalledWith({ moduleId: 'm', hook: 'onSessionStart', error });
  });
});
