import JsonResponse, {StatusType} from '../common/Protocol/JsonResponse';

export function makeSuccessResponse<T>(msg: string, content: T) : JsonResponse<T> {
    return {
        status: {
            type: StatusType.success,
            message: msg
        },
        content
    };
}

export function makeFailureResponse(msg: string): JsonResponse<void> {
    return {
        status: {
            type: StatusType.failure,
            message: msg
        },
        content: null
    };
}
