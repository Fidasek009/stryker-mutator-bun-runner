interface StateInput {
  items: string[];
}

function createState(input: StateInput): StateInput {
  if (!input.items) {
    throw new Error('items is required');
  }
  return input;
}

export const initialState = createState({ items: [] });
