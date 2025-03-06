import {jest} from "@jest/globals";


export class ItemsServiceMock {
  // this static field is needed so that it can be accessed from the tests
  static updateOne = jest.fn();
  updateOne = ItemsServiceMock.updateOne;
}

const mockServices = { ItemsService: ItemsServiceMock };

export function callHook(hookDefinitionFunction, hookParams) {
  // execute the hook definition with a mock to get a reference to the hook callback function,
  // so it can be called with the param specified in the test case
  const action = jest.fn()
  hookDefinitionFunction(action, mockServices);
  const hook = action.mock.calls[0][1];

  // call the hook with the hookParams
  hook(hookParams, {schema: {}, database: {}});
}
