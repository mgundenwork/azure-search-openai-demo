import React, { useState, useEffect, useCallback } from 'react';
import { Dropdown, IDropdownOption, TextField, PrimaryButton, Spinner, IconButton, Panel, PanelType, Checkbox, Icon, Slider, IPanel } from '@fluentui/react';
import { searchApi, SearchResult, SearchRequest, SearchResponse, ChatAppResponse } from '../../api';
import { useLogin, getToken, isLoggedIn } from "../../authConfig";
import { useMsal } from "@azure/msal-react";
import { getCitationFilePath } from "../../api";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
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
    const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [activeCitation, setActiveCitation] = useState<string | undefined>(undefined);
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);
    const [isSearchBoxVisible, setIsSearchBoxVisible] = useState<boolean>(true);
    
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
                maxResults: Number(maxResults),
                minSimilarity: searchType !== SearchType.Keyword ? minSimilarity : undefined
            };

            console.log("Search request:", JSON.stringify(searchRequest, null, 2));

            const searchResults = await searchApi(searchRequest, token);
            
            console.log("Search results:", searchResults);
            console.log("Number of results returned:", searchResults.length);
            
            if (Array.isArray(searchResults)) {
                setResults(searchResults);
            } else {
                console.error("Unexpected search results format:", searchResults);
                setError('Received unexpected search results format.');
            }
            setIsSearchBoxVisible(false);  // Hide search box after search
        } catch (error) {
            console.error('Search failed:', error);
            setError('An error occurred during the search. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const getCitation = (sourcepage: string): string => {
        console.log("Getting citation for:", sourcepage);  // Log the input
        const [path, ext] = sourcepage.split('.');
        if (ext && ext.toLowerCase() === 'png') {
            const pageIdx = path.lastIndexOf('-');
            if (pageIdx !== -1) {
                const pageNumber = parseInt(path.slice(pageIdx + 1), 10);
                const result = `${path.slice(0, pageIdx)}.pdf#page=${pageNumber}`;
                console.log("Resulting citation:", result);  // Log the result
                return result;
            }
        }
        console.log("Returning original sourcepage");  // Log when returning original
        return sourcepage;
    };

    const extractPageNumber = (sourcepage: string): string => {
        console.log("Extracting page number from:", sourcepage);  // Log the input
        // Try to extract page number from filename (e.g., "document-name-123.pdf")
        const fileNameMatch = sourcepage.match(/-(\d+)\.pdf$/);
        if (fileNameMatch) {
            console.log("Page number from filename:", fileNameMatch[1]);  // Log when found in filename
            return fileNameMatch[1];
        }

        // If not found in filename, try to extract from citation format
        const citation = getCitation(sourcepage);
        const pageMatch = citation.match(/#page=(\d+)$/);
        if (pageMatch) {
            console.log("Page number from citation:", pageMatch[1]);  // Log when found in citation
            return pageMatch[1];
        }

        console.log("Page number not found, returning N/A");  // Log when not found
        return 'N/A';
    };

    const handleCitationClick = (sourcepage: string) => {
        console.log("Citation click for:", sourcepage);  // Log the clicked sourcepage
        const citation = getCitation(sourcepage);
        const fullCitationPath = `/content/${citation}`;
        console.log("Full citation path:", fullCitationPath);  // Log the full path
        setActiveCitation(activeCitation === fullCitationPath ? undefined : fullCitationPath);
    };

    const renderSearchResults = () => {
        return results.map((result, index) => (
            <div key={index} className={styles.searchResult}>
                <h3>{index + 1}. {result.title}</h3>
                {result.sourcepage && (
                    <p>Page: {extractPageNumber(result.sourcepage)} (Source: {result.sourcepage})</p>
                )}
                <p>Similarity: {result.similarity.toFixed(2)}</p>
                <PrimaryButton onClick={() => handleCitationClick(result.sourcepage)}>View Document</PrimaryButton>
                <div className={styles.contentToggle}>
                    <Checkbox
                        label="Show Content"
                        onChange={(_, checked) => {
                            const contentElement = document.getElementById(`content-${index}`);
                            if (contentElement) {
                                contentElement.style.display = checked ? 'block' : 'none';
                            }
                        }}
                    />
                </div>
                <div id={`content-${index}`} style={{display: 'none'}}>
                    <p>{result.content}</p>
                </div>
            </div>
        ));
    };

    const createFakeChatAppResponse = (): ChatAppResponse => {
        return {
            message: { role: 'assistant', content: '' },
            delta: { role: 'assistant', content: '' },
            context: {
                data_points: results.map(r => `${getCitationFilePath(r.sourcepage)}: ${r.content}`),
                followup_questions: [],
                thoughts: [] // If thoughts are required, provide an empty array
            },
            session_state: null
        };
    };


    return (
        <div className={styles.searchContainer}>
            {isSearchBoxVisible ? (
                <div className={styles.searchTopSection}>
                    <h1 className={styles.searchTitle}>Search</h1>
                    <div className={styles.searchControls}>
                        <TextField 
                            label="Search Query" 
                            value={query} 
                            onChange={(_, newValue) => setQuery(newValue || '')} 
                        />
                        <Dropdown
                            label="Search Type"
                            selectedKey={searchType}
                            options={[
                                { key: SearchType.Keyword, text: 'Keyword' },
                                { key: SearchType.Vector, text: 'Vector' },
                                { key: SearchType.Hybrid, text: 'Hybrid' },
                            ]}
                            onChange={(_, option) => option && setSearchType(option.key as SearchType)}
                        />
                        <Checkbox
                            label="Use Semantic Ranker"
                            checked={useSemanticRanker}
                            onChange={(_, checked) => setUseSemanticRanker(!!checked)}
                        />
                        <TextField
                            label="Max Results"
                            type="number"
                            value={maxResults.toString()}
                            onChange={(_, newValue) => setMaxResults(Number(newValue) || 5)}
                        />
                        {searchType !== SearchType.Keyword && (
                            <TextField
                                label="Minimum Similarity"
                                type="number"
                                value={minSimilarity.toString()}
                                onChange={(_, newValue) => setMinSimilarity(Number(newValue) || 0.7)}
                                step={0.1}
                                min={0}
                                max={1}
                            />
                        )}
                        <PrimaryButton text="Search" onClick={handleSearch} disabled={isLoading || !query.trim()} />
                    </div>
                </div>
            ) : (
                <div className={styles.searchTopSection}>
                    <IconButton
                        iconProps={{ iconName: 'Search' }}
                        onClick={() => setIsSearchBoxVisible(true)}
                        className={styles.showSearchButton}
                    />
                </div>
            )}
            <div className={`${styles.searchBottomSection} ${activeCitation ? styles.withCitation : ''}`}>
                {isLoading && <Spinner label="Searching..." />}
                {error && <div className={styles.errorMessage}>{error}</div>}
                <div className={styles.searchResults}>
                    {renderSearchResults()}
                </div>
                {activeCitation && (
                    <div className={styles.pdfViewerContainer}>
                        <iframe 
                            src={activeCitation} 
                            className={styles.pdfViewer}
                            title="PDF Viewer"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};