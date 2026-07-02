export * from './types';
export * from './identity';
export * from './project-migration';
export * from './compiler';
export * from './actions';
export * from './expression-evaluator';
export * from './action-resolver';
export * from './fragment-store';
export * from './turn-resolver';
export * from './chronica-session';
export * from './validator';
export * from './editor-helpers';
export * from './story-graph';
export * from './asset-resolver';
export * from './player-presentation';
export * from './chronica-package';
export * from './hotspot-helpers';
export * from './hotspots';
export * from './stage-actors';
export * from './load-game';

// Runtime compatibility layer — object-oriented facade that mirrors the main
// Chronica engine's runtime shape (ChronicaSession, ChronicaState,
// FragmentStore, TurnResolver, ExpressionEvaluator, ActionResolver, EventBus,
// Module system, save envelope). Wraps existing pure functions; introduces no
// new gameplay rules and no Godot-specific concepts.
export * as compat from './compat';
