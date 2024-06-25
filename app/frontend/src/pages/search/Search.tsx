import React, { useState, useEffect } from 'react';
import { Dropdown, IDropdownOption, TextField, PrimaryButton, Slider, Spinner } from '@fluentui/react';
import { searchApi, SearchResult, SearchRequest, SearchResponse  } from '../../api';
import { useLogin, getToken, isLoggedIn } from "../../authConfig";
import { useMsal } from "@azure/msal-react";
import styles from './Search.module.css';

enum SearchType {
    Keyword = 'keyword',
    Vector = 'vector',
    Hybrid = 'hybrid'
}

export const Search: React.FC = () => {
    const [searchType, setSearchType] = useState<SearchType>(SearchType.Keyword);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(false);
    const [maxResults, setMaxResults] = useState<number>(5);
    const [minSimilarity, setMinSimilarity] = useState<number>(0.7);
    const [query, setQuery] = useState<string>('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    const client = useLogin ? useMsal().instance : undefined;

    useEffect(() => {
        const checkAuth = async () => {
            if (useLogin && client) {
                const loggedIn = isLoggedIn(client);
                console.log("Is user logged in?", loggedIn);
                setIsAuthenticated(loggedIn);
            } else {
                console.log("Login not used or client not available");
                setIsAuthenticated(true); // Assume authenticated if login is not used
            }
        };
        checkAuth();
    }, [client]);

    const searchTypeOptions: IDropdownOption[] = [
        { key: SearchType.Keyword, text: 'Keyword Search' },
        { key: SearchType.Vector, text: 'Vector Search' },
        { key: SearchType.Hybrid, text: 'Hybrid Search' }
    ];

    const handleSearch = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = useLogin && client ? await getToken(client) : undefined;
    
            const searchRequest: SearchRequest = {
                query,
                searchType: searchType.toLowerCase() as 'keyword' | 'vector' | 'hybrid',
                useSemanticRanker,
                maxResults: Number(maxResults),  // Ensure this is a number
                minSimilarity: searchType !== SearchType.Keyword ? minSimilarity : undefined
            };
    
            console.log("Search request:", searchRequest);
    
            const searchResults = await searchApi(searchRequest, token);
            
            console.log("Search results:", searchResults);
            
            if (Array.isArray(searchResults)) {
                setResults(searchResults);
            } else {
                console.error("Unexpected search results format:", searchResults);
                setError('Received unexpected search results format.');
            }
        } catch (error) {
            console.error('Search failed:', error);
            setError('An error occurred during the search. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.searchContainer}>
            <h1 className={styles.searchTitle}>Search</h1>
            <div className={styles.searchControls}>
                <Dropdown
                    label="Search Type"
                    selectedKey={searchType}
                    options={searchTypeOptions}
                    onChange={(_, option) => option && setSearchType(option.key as SearchType)}
                />
                <TextField
                    label="Search Query"
                    value={query}
                    onChange={(_, newValue) => setQuery(newValue || '')}
                />
                <Dropdown
                    label="Use Semantic Ranker"
                    selectedKey={useSemanticRanker ? 'yes' : 'no'}
                    options={[
                        { key: 'yes', text: 'Yes' },
                        { key: 'no', text: 'No' }
                    ]}
                    onChange={(_, option) => option && setUseSemanticRanker(option.key === 'yes')}
                />
                <TextField
                    label="Max Results"
                    type="number"
                    value={maxResults.toString()}
                    onChange={(_, newValue) => setMaxResults(Number(newValue) || 3)}
                    min={1}
                    max={500}  // You can adjust this maximum value as needed
                />
                {searchType !== SearchType.Keyword && (
                    <Slider
                        label="Minimum Similarity"
                        min={0}
                        max={1}
                        step={0.01}
                        value={minSimilarity}
                        onChange={setMinSimilarity}
                    />
                )}
                <PrimaryButton text="Search" onClick={handleSearch} disabled={isLoading || !query.trim()} />
            </div>
            {isLoading && <Spinner label="Searching..." />}
            {error && <div className={styles.errorMessage}>{error}</div>}
            <div className={styles.searchResults}>
                {results.map((result, index) => (
                    <div key={index} className={styles.searchResult}>
                        <h3>{result.title}</h3>
                        <p>{result.content}</p>
                        {result.similarity !== undefined && <p>Similarity: {result.similarity.toFixed(2)}</p>}
                    </div>
                ))}
            </div>
        </div>
    );
};