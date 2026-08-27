import { Stack } from "expo-router";
import { useState } from "react";
import { SearchScreen } from "@modules/search/screen";

export default function SearchRoute() {
  const [query, setQuery] = useState("");

  return (
    <>
      <Stack.Screen
        options={{
          title: "Search",
          headerSearchBarOptions: {
            placeholder: "Search feeds or paste a URL",
            placement: "automatic",
            onChangeText: (event) => setQuery(event.nativeEvent.text),
          },
        }}
      />
      <SearchScreen onQueryChange={setQuery} query={query} />
    </>
  );
}
