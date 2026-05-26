import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs';

const params = generatorParameters({ enable_fuzz: true, enable_short_term: true });
const scheduler = fsrs(params);

const RATING_MAP = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

const STATE_TO_DB = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const DB_TO_STATE = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

function dbCardToFsrs(card) {
  const empty = createEmptyCard();
  return {
    ...empty,
    due: card.due_date ? new Date(card.due_date) : empty.due,
    stability: Number(card.stability) || empty.stability,
    difficulty: Number(card.difficulty) || empty.difficulty,
    state: DB_TO_STATE[card.state] ?? State.New,
    last_review: card.last_review ? new Date(card.last_review) : empty.last_review,
    reps: Number(card.reps) || 0,
    lapses: Number(card.lapses) || 0,
    elapsed_days: empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
  };
}

export function rate(card, rating, now = new Date()) {
  const fsrsRating = RATING_MAP[rating];
  if (fsrsRating === undefined) {
    throw new Error(`Invalid rating ${rating} (must be 1-4)`);
  }
  const fsrsCard = dbCardToFsrs(card);
  const result = scheduler.next(fsrsCard, now, fsrsRating);
  const updated = result.card;
  return {
    stability: updated.stability,
    difficulty: updated.difficulty,
    due_date: updated.due,
    state: STATE_TO_DB[updated.state],
    reps: updated.reps,
    lapses: updated.lapses,
    last_review: updated.last_review,
  };
}
