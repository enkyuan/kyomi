import { Redirect } from "expo-router";
import { useIsAuthenticated } from "@lib/session";

export default function IndexScreen() {
  const isAuthenticated = useIsAuthenticated();
  return <Redirect href={isAuthenticated ? "/(protected)/inbox" : "/(auth)/login"} />;
}
