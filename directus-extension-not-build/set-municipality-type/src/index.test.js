import {municipalityUpdateHook} from "./index.js";
import {callHook, ItemsServiceMock} from "./test-setup.js";


describe('hook', function () {
  it('should return Kleinstadt', () => {
    callHook(municipalityUpdateHook, {keys: ["some_id"], payload: {population: 1}});
    expect(ItemsServiceMock.updateOne).toHaveBeenCalledWith("some_id", {municipality_type: "Kleinstadt"});
  });
  it('should return Mittelstadt', () => {
    callHook(municipalityUpdateHook, {keys: ["some_id"], payload: {population: 20000}});
    expect(ItemsServiceMock.updateOne).toHaveBeenCalledWith("some_id", {municipality_type: "Mittelstadt"});
  });
  it('should return Großstadt', () => {
    callHook(municipalityUpdateHook, {keys: ["some_id"], payload: {population: 1000000}});
    expect(ItemsServiceMock.updateOne).toHaveBeenCalledWith("some_id", {municipality_type: "Großstadt"});
  });
});
