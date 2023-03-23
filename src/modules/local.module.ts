const path = require('path');
const admZip = require('adm-zip');
const xml2js = require('xml2js');
const minimatch = require('minimatch');

import * as fs from 'fs/promises';
import AdmZip = require("adm-zip");
import { PackageMetadata, PackageSearchResult, PackageVersion, SearchPackageResultVersion } from "../models/nuget.model";
import { PackageSource } from "../models/option.model";

async function readNuspecFile(zip: AdmZip): Promise<PackageMetadata | null>
{
    const zipEntries = zip.getEntries();
    for (const zipEntry of zipEntries)
    {
        if (zipEntry.name.endsWith('.nuspec'))
        {
            const nuspecXml = zipEntry.getData().toString('utf8');
            let result: any;
            try
            {
                result = await xml2js.parseStringPromise(nuspecXml);
            } catch (error: any)
            {
                console.error(`Failed to parse nuspec XML from ${zipEntry.name}: ${error.message}`);
                return null;
            }
            const metadata: PackageMetadata = {
                id: result?.package?.metadata?.[0]?.id?.[0] ?? '',
                registration: result?.package?.metadata?.[0]?.registration?.[0] ?? '',
                version: result?.package?.metadata?.[0]?.version?.[0] ?? '',
                description: result?.package?.metadata?.[0]?.description?.[0] ?? '',
                summary: result?.package?.metadata?.[0]?.summary?.[0] ?? '',
                title: result?.package?.metadata?.[0]?.title?.[0] ?? '',
                iconUrl: result?.package?.metadata?.[0]?.iconUrl?.[0] ?? '',
                licenseUrl: result?.package?.metadata?.[0]?.licenseUrl?.[0] ?? '',
                projectUrl: result?.package?.metadata?.[0]?.projectUrl?.[0] ?? '',
                tags: result?.package?.metadata?.[0]?.tags?.[0]?.tag ?? [],
                authors: result?.package?.metadata?.[0]?.authors?.[0]?.author ?? [],
                totalDownloads: parseInt(result?.package?.metadata?.[0]?.totalDownloads?.[0] ?? '0', 10),
                verified: result?.package?.metadata?.[0]?.verified?.[0] === 'true',
                packageTypes: result?.package?.metadata?.[0]?.packageTypes?.[0]?.packageType?.map((type: any) => ({
                    name: type?.$?.name ?? '',
                    version: type?.$?.version ?? '',
                })) ?? [],
                versions: [],
            };
            return metadata;
        }
    }
    return null;
}

export async function localSearchPackage(query: string, packageSource: PackageSource, take?: number, skip?: number): Promise<any>
{
    const searchResult: any = {
        data: [],
        packageSourceId: packageSource.id,
        packageSourceName: packageSource.sourceName,
        totalHits: 0
    };

    if (!packageSource.sourceDirectory)
    {
        return searchResult;
    }

    var nugetDirectory: string = packageSource.sourceDirectory;
    const files = await fs.readdir(nugetDirectory);
    let filteredFiles = files.filter((file) => minimatch(file, query, { nocase: true }));
    filteredFiles = filteredFiles.length > 0 ? filteredFiles : files.filter(file =>
    {
        const lowerCaseFile = file.toLowerCase();
        const lowerCaseQuery = query.toLowerCase();
        return lowerCaseFile.includes(lowerCaseQuery);
    });


    const metadataPromises = filteredFiles
        .filter((file: string) => path.extname(file) === '.nupkg')
        .map(async (file: string) =>
        {
            const buffer = await fs.readFile(path.join(nugetDirectory, file));
            const zip = new admZip(buffer);
            return readNuspecFile(zip);
        })
        .filter((metadata) => metadata !== null) as Promise<PackageMetadata>[];

    const allMetadata = await Promise.all(metadataPromises);
    const uniqueMetadata = allMetadata.reduce((acc: PackageMetadata[], current: PackageMetadata) =>
    {
        current.versions = [{ version: current.version, downloads: 0 }];
        const existing = acc.find(item => item.id === current.id);
        if (existing)
        {
            existing.versions = Array.from(new Set([...existing.versions, ...current.versions]));
        } else
        {
            acc.push(current);
        }
        return acc;
    }, []);

    searchResult.data = uniqueMetadata;
    return searchResult;
}

export async function localGetPackageVersions(packageName: string, packageSource: PackageSource): Promise<PackageVersion>
{
    var localSearch = await localSearchPackage(packageName, packageSource);
    const metadata = localSearch.data.find((metadata: PackageMetadata) => metadata.id === packageName);
    const versions: string[] = metadata.versions.map((version: SearchPackageResultVersion) => version.version);

    var packageVersion: PackageVersion = {
        packageName: packageName,
        versions: versions,
        sourceName: packageSource.sourceName,
        sourceId: packageSource.id,
    };

    return Promise.resolve<PackageVersion>(packageVersion);
}