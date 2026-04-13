import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { BrowserRouter } from "react-router";
import App from "./app";
import i18n from "./i18n";
import "./app.css";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: 1,
		},
	},
});

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<I18nextProvider i18n={i18n}>
				<BrowserRouter>
					<App />
				</BrowserRouter>
			</I18nextProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
