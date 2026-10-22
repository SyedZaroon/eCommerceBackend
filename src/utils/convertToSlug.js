export function convertToSlug(title) {
    return title
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')           
        .replace(/[^\w\-]+/g, '')          
        .replace(/\-\-+/g, '-')            
        .replace(/^-+/, '')                
        .replace(/-+$/, '');              
}